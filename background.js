const OFFSCREEN_PATH = 'offscreen.html';
const MAX_GAIN = 10;
const DEFAULT_GAIN = 1;

let creatingOffscreen;
const restartJobs = new Map();

async function ensureOffscreenDocument() {
  const url = chrome.runtime.getURL(OFFSCREEN_PATH);

  if ('getContexts' in chrome.runtime) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [url]
    });
    if (contexts.length > 0) return;
  }

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ['USER_MEDIA', 'AUDIO_PLAYBACK'],
    justification: 'Capture tab audio, amplify it with Web Audio, and play it back to the user.'
  });

  try {
    await creatingOffscreen;
  } finally {
    creatingOffscreen = null;
  }
}

async function sendToOffscreen(message) {
  await ensureOffscreenDocument();
  return chrome.runtime.sendMessage({ target: 'offscreen', ...message });
}

function normalizeSiteKey(url, tabId) {
  try {
    const parsed = new URL(url || '');
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.hostname.replace(/^www\./i, '').toLowerCase();
    }
  } catch (_) {
    // Ignore invalid/non-web URLs.
  }
  return `tab:${tabId}`;
}

function clampGain(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_GAIN;
  return Math.min(MAX_GAIN, Math.max(DEFAULT_GAIN, numeric));
}

async function getSiteSettings() {
  const { siteSettings = {} } = await chrome.storage.local.get({ siteSettings: {} });
  return siteSettings;
}

async function getSiteGain(siteKey) {
  const siteSettings = await getSiteSettings();
  return clampGain(siteSettings[siteKey] ?? DEFAULT_GAIN);
}

async function setSiteGain(siteKey, gain) {
  const siteSettings = await getSiteSettings();
  siteSettings[siteKey] = clampGain(gain);
  await chrome.storage.local.set({ siteSettings });
}

async function getTabStates() {
  const { tabStates = {} } = await chrome.storage.session.get({ tabStates: {} });
  return tabStates;
}

async function getTabState(tabId) {
  const tabStates = await getTabStates();
  return tabStates[String(tabId)] || null;
}

async function setTabState(tabId, state) {
  const tabStates = await getTabStates();
  tabStates[String(tabId)] = state;
  await chrome.storage.session.set({ tabStates });
}

async function clearTabState(tabId) {
  const tabStates = await getTabStates();
  delete tabStates[String(tabId)];
  await chrome.storage.session.set({ tabStates });
}

async function stopTab(tabId, clearState = true) {
  restartJobs.delete(tabId);

  try {
    await sendToOffscreen({ type: 'STOP_AUDIO', tabId });
  } catch (error) {
    console.warn('Could not stop tab audio:', error);
  }

  if (clearState) {
    await clearTabState(tabId);
  }
}

async function startTab(tabId, siteKey, gain) {
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  const result = await sendToOffscreen({
    type: 'START_AUDIO',
    tabId,
    streamId,
    gain
  });

  await setSiteGain(siteKey, gain);
  await setTabState(tabId, {
    enabled: true,
    siteKey,
    gain,
    startedAt: Date.now()
  });

  return { ...result, tabId, siteKey, gain, enabled: true };
}

async function scheduleCaptureRestart(tabId) {
  if (restartJobs.has(tabId)) return;

  const state = await getTabState(tabId);
  if (!state?.enabled) return;

  const job = (async () => {
    const delays = [150, 700];

    for (const delay of delays) {
      const latest = await getTabState(tabId);
      if (!latest?.enabled) return;

      await new Promise((resolve) => setTimeout(resolve, delay));

      try {
        const result = await startTab(tabId, latest.siteKey, latest.gain);
        if (result?.running) return;
      } catch (error) {
        console.warn(`Capture restart attempt failed for tab ${tabId}:`, error);
      }
    }

    // The capture could not be restored. Keep the saved site gain, but turn
    // off only the transient tab session.
    await clearTabState(tabId);
  })();

  restartJobs.set(tabId, job);

  try {
    await job;
  } finally {
    if (restartJobs.get(tabId) === job) restartJobs.delete(tabId);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'START') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) throw new Error('No active tab was found.');

        const tabId = tab.id;
        const siteKey = normalizeSiteKey(tab.url, tabId);
        const gain = clampGain(message.gain ?? await getSiteGain(siteKey));

        // Starting again on the same tab cleanly replaces only that tab's
        // audio session. Other tabs keep their own independent sessions.
        const result = await startTab(tabId, siteKey, gain);
        sendResponse({ ok: true, ...result });
        return;
      }

      if (message.type === 'STOP') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) throw new Error('No active tab was found.');

        await stopTab(tab.id, true);
        sendResponse({ ok: true, enabled: false });
        return;
      }

      if (message.type === 'SET_GAIN') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) throw new Error('No active tab was found.');

        const tabId = tab.id;
        const siteKey = normalizeSiteKey(tab.url, tabId);
        const gain = clampGain(message.gain);
        await setSiteGain(siteKey, gain);

        const state = await getTabState(tabId);
        if (state?.enabled && state.siteKey === siteKey) {
          const result = await sendToOffscreen({ type: 'SET_GAIN', tabId, gain });
          await setTabState(tabId, { ...state, siteKey, gain });
          sendResponse({ ok: true, ...result, tabId, siteKey, gain, enabled: true });
          return;
        }

        sendResponse({ ok: true, running: false, tabId, siteKey, gain, enabled: false });
        return;
      }

      if (message.type === 'GET_STATE') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) throw new Error('No active tab was found.');

        const tabId = tab.id;
        const siteKey = normalizeSiteKey(tab.url, tabId);
        const gain = await getSiteGain(siteKey);
        const state = await getTabState(tabId);

        if (state?.enabled && state.siteKey !== siteKey) {
          // The tab navigated to a different site. Never carry the old site's
          // active capture state or volume into the new site.
          await stopTab(tabId, true);
          sendResponse({ ok: true, enabled: false, gain, tabId, siteKey });
          return;
        }

        sendResponse({
          ok: true,
          enabled: Boolean(state?.enabled),
          gain,
          tabId,
          siteKey
        });
        return;
      }

      if (message.type === 'AUDIO_ENDED') {
        const tabId = Number(message.tabId);
        const state = await getTabState(tabId);
        if (state?.enabled) {
          await scheduleCaptureRestart(tabId);
        }
        return;
      }

      sendResponse({ ok: false, error: 'Unknown message.' });
    } catch (error) {
      console.error(error);
      sendResponse({
        ok: false,
        error: error?.message || 'An unexpected error occurred.'
      });
    }
  })();

  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  stopTab(tabId).catch(console.error);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // IMPORTANT: Do not stop on changeInfo.status === 'loading'.
  // YouTube and other SPA video sites can fire loading events while the same
  // site continues playing another video. Stopping here was the main cause
  // of playback being muted between videos.
  if (!changeInfo.url) return;

  (async () => {
    const state = await getTabState(tabId);
    if (!state?.enabled) return;

    const newSiteKey = normalizeSiteKey(changeInfo.url, tabId);
    if (state.siteKey === newSiteKey) {
      // Same site (e.g. youtube.com/watch?v=... -> another video): keep the
      // capture session alive and preserve the site's saved gain.
      return;
    }

    // Different site in the same tab: stop the old site's audio session so its
    // gain can never leak into the new site.
    await stopTab(tabId, true);
  })().catch(console.error);
});

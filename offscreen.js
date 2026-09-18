const sessions = new Map();
let sessionCounter = 0;

function createAudioGraph(stream, gainValue) {
  const audioContext = new AudioContext();
  const sourceNode = audioContext.createMediaStreamSource(stream);
  const gainNode = audioContext.createGain();
  const compressorNode = audioContext.createDynamicsCompressor();

  compressorNode.threshold.value = -18;
  compressorNode.knee.value = 18;
  compressorNode.ratio.value = 6;
  compressorNode.attack.value = 0.003;
  compressorNode.release.value = 0.15;

  gainNode.gain.value = Math.min(10, Math.max(1, Number(gainValue) || 1));

  sourceNode.connect(gainNode);
  gainNode.connect(compressorNode);
  compressorNode.connect(audioContext.destination);

  return { audioContext, sourceNode, gainNode, compressorNode };
}

async function startAudio(tabId, streamId, gainValue) {
  await stopAudio(tabId);

  const mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    },
    video: false
  });

  const graph = createAudioGraph(mediaStream, gainValue);
  await graph.audioContext.resume();

  const token = ++sessionCounter;
  const session = { tabId, token, mediaStream, ...graph };
  sessions.set(tabId, session);

  for (const track of mediaStream.getAudioTracks()) {
    track.addEventListener('ended', () => {
      const current = sessions.get(tabId);
      if (!current || current.token !== token) return;

      stopAudio(tabId)
        .then(() => chrome.runtime.sendMessage({ type: 'AUDIO_ENDED', tabId }).catch(() => {}))
        .catch(console.error);
    }, { once: true });
  }

  return { running: true, tabId, gain: Number(gainValue) || 1 };
}

async function stopAudio(tabId) {
  const session = sessions.get(tabId);
  if (!session) return { running: false, tabId };

  sessions.delete(tabId);

  try { session.sourceNode.disconnect(); } catch (_) {}
  try { session.gainNode.disconnect(); } catch (_) {}
  try { session.compressorNode.disconnect(); } catch (_) {}

  for (const track of session.mediaStream.getTracks()) {
    try { track.stop(); } catch (_) {}
  }

  try {
    await session.audioContext.close();
  } catch (_) {
    // Ignore teardown errors.
  }

  return { running: false, tabId };
}

async function setGain(tabId, gain) {
  const session = sessions.get(tabId);
  if (!session) return { running: false, tabId, gain };

  const clamped = Math.min(10, Math.max(1, Number(gain) || 1));
  session.gainNode.gain.setTargetAtTime(
    clamped,
    session.audioContext.currentTime,
    0.01
  );

  return { running: true, tabId, gain: clamped };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  (async () => {
    const tabId = Number(message.tabId);

    try {
      if (message.type === 'START_AUDIO') {
        sendResponse(await startAudio(tabId, message.streamId, Number(message.gain) || 1));
        return;
      }

      if (message.type === 'STOP_AUDIO') {
        sendResponse(await stopAudio(tabId));
        return;
      }

      if (message.type === 'SET_GAIN') {
        sendResponse(await setGain(tabId, Number(message.gain) || 1));
        return;
      }

      sendResponse({ running: false, error: 'Unknown message.' });
    } catch (error) {
      console.error('Audio engine error:', error);
      await stopAudio(tabId);
      sendResponse({
        running: false,
        error: error?.message || 'Audio processing could not be started.'
      });
    }
  })();

  return true;
});

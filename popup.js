const gainSlider = document.getElementById('gainSlider');
const gainLabel = document.getElementById('gainLabel');
const toggleButton = document.getElementById('toggleButton');
const statusDot = document.getElementById('statusDot');
const statusTitle = document.getElementById('statusTitle');
const message = document.getElementById('message');
const siteLabel = document.getElementById('siteLabel');

function setMessage(text) {
  message.textContent = text;
}

function renderState(enabled, gain, siteKey) {
  const percent = Math.round(gain * 100);
  gainSlider.value = String(percent);
  gainLabel.textContent = `${percent}%`;
  statusDot.classList.toggle('on', enabled);
  toggleButton.textContent = enabled ? 'Stop Boost' : 'Start Boost';
  toggleButton.classList.toggle('stop', enabled);
  statusTitle.textContent = enabled ? 'Boost active' : 'Ready to boost';
  siteLabel.textContent = siteKey ? `Saved for ${siteKey}` : 'Saved for this site';
}

async function getState() {
  return chrome.runtime.sendMessage({ type: 'GET_STATE' });
}

gainSlider.addEventListener('input', async () => {
  const gain = Number(gainSlider.value) / 100;
  gainLabel.textContent = `${Math.round(gain * 100)}%`;
  const response = await chrome.runtime.sendMessage({ type: 'SET_GAIN', gain });
  if (!response?.ok) setMessage(response?.error || 'Could not update the boost level.');
});

toggleButton.addEventListener('click', async () => {
  toggleButton.disabled = true;
  setMessage('Processing audio…');

  try {
    const state = await getState();
    if (state?.enabled) {
      const response = await chrome.runtime.sendMessage({ type: 'STOP' });
      if (!response?.ok) throw new Error(response?.error || 'Could not stop audio boost.');
      renderState(false, Number(gainSlider.value) / 100, state.siteKey);
      setMessage('Audio boost is off for this tab.');
      return;
    }

    const gain = Number(gainSlider.value) / 100;
    const response = await chrome.runtime.sendMessage({ type: 'START', gain });
    if (!response?.ok) throw new Error(response?.error || 'Could not start audio boost.');
    renderState(true, gain, response.siteKey || state.siteKey);
    setMessage('This tab is being boosted independently.');
  } catch (error) {
    const state = await getState().catch(() => null);
    renderState(
      Boolean(state?.enabled),
      Number(gainSlider.value) / 100,
      state?.siteKey
    );
    setMessage(error?.message || 'Something went wrong.');
  } finally {
    toggleButton.disabled = false;
  }
});

(async () => {
  const state = await getState();
  if (state?.ok) {
    renderState(Boolean(state.enabled), Number(state.gain) || 1, state.siteKey);
  }
})();

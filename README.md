# Doki Sound Booster

Doki Sound Booster is a free, open-source Chrome extension that boosts the audio of the active tab using Manifest V3, `chrome.tabCapture`, an offscreen document, and the Web Audio API.

## Highlights

- Up to **1000% volume boost**.
- **Independent settings for each tab/site** so one tab does not inherit another tab's boost level.
- Web Audio gain control with the existing dynamics-compression chain.
- Lightweight Manifest V3 architecture.
- No external backend and no account required.
- English UI.
- MIT licensed.

## Install locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.
5. Open a tab with audio, open Doki Sound Booster, set its boost level, and click **Start Boost**. Each tab/site keeps its own saved level.

## Developer

**M. Doğukan Cengiz**

Support on Patreon: https://www.patreon.com/cw/dogukancengiz

Thanks for using Doki Sound Booster!

### Reliability notes

- Site profiles are keyed by hostname, so changing YouTube videos does not change the saved YouTube volume.
- Navigating from one website to another in the same tab stops the previous site session instead of leaking its gain into the new site.
- The extension no longer stops capture on ordinary `loading` updates, preventing the common YouTube next-video mute/restart bug.
- If a captured audio track unexpectedly ends, the extension attempts a short automatic recapture while the tab is still enabled.

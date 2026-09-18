# Doki Sound Booster

> **Turn up your sound. Keep control.**

Doki Sound Booster is a lightweight Chrome extension built for people who want more control over the audio coming from their browser tabs. It lets you increase tab volume up to **1000%**, keep **site-specific audio settings**, and adjust the current tab without changing the volume settings of other sites.

The project is **free and open source**.

### What is Doki Sound Booster?

Doki Sound Booster is a lightweight, open-source Chrome extension made for people who want more control over the audio coming from their browser tabs.

The idea is simple: when a video, music stream, or other web content is too quiet, you should be able to adjust that tab directly instead of constantly changing your system volume.

### Main features

* 🔊 **Up to 1000% volume boost** — Raise tab audio well beyond the browser's normal level.
* 🌐 **Site-specific settings** — A setting saved for YouTube does not need to affect Spotify or other websites.
* 🗂️ **Independent tab sessions** — Different tabs can maintain their own audio state.
* 🎚️ **Simple volume control** — Quickly adjust the current tab from the extension interface.
* ⚙️ **Audio processing support** — Built around browser-side audio processing and ready for additional controls.
* 🔒 **Privacy-focused design** — Audio processing is performed locally in the browser.
* 🧩 **Chrome Manifest V3** — Built using the modern Chrome extension architecture.

### How it works

Doki Sound Booster captures the audio stream of the selected tab and processes it locally with the Web Audio API. The requested gain level is applied before the processed audio is sent back to the output.

Because settings are stored per site, you can use different levels such as:

```text
youtube.com  →  700%
spotify.com  →  350%
example.com  →  150%
```

without having to use the same value everywhere.

### Installation

1. Clone or download the repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the project folder.
6. Open a tab that is playing audio and launch Doki Sound Booster.

### Privacy

Doki Sound Booster is designed to work locally in the browser. Audio does not need to be uploaded to a remote server for the extension to work.

The extension permissions are used for:

* `activeTab` → Interact with the tab the user explicitly activates.
* `tabCapture` → Capture the tab's audio stream for processing.
* `offscreen` → Run audio processing in an offscreen document.
* `storage` → Save site-specific user preferences.

### Development

Some areas that are suitable for future improvements:

* Advanced EQ controls
* Bass and treble adjustment
* Limiter and distortion protection
* Real-time audio level visualization
* More detailed site profiles
* Improved popup design
* Dedicated settings page

Issues, feedback, and pull requests are welcome.

### License

This project is licensed under the **MIT License**.

---

## Developer

**M. Doğukan Cengiz**

Doki Sound Booster is a free, open-source project focused on practical browser audio control.

**Patreon:**
[https://www.patreon.com/cw/dogukancengiz](https://www.patreon.com/cw/dogukancengiz)

Thanks for using **Doki Sound Booster**. ❤️

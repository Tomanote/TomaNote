# TomaNote — Free Online Notepad 📝

<div align="center">

![Version](https://img.shields.io/badge/version-0.5.8-blue.svg)
![License](https://img.shields.io/badge/license-AGPL%20v3-green.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)
![Mobile](https://img.shields.io/badge/mobile-responsive-success)

[Live Demo](https://tomanote.app) | [Report a Bug](https://github.com/Tomanote/TomaNote/issues) | [Request a Feature](https://github.com/Tomanote/TomaNote/issues)

[!["Buy Me A Coffee"](https://img.shields.io/badge/Buy_Me_A_Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/dftp930)

</div>

## 📋 Description

TomaNote is a modern, minimalist notepad that runs directly in your browser. No accounts, no sign-up, no servers. Just open it and start writing. All your notes are saved locally on your device — private by design, offline by default.

> Want to see what's coming next?
> Check the **Roadmap** inside the app at [tomanote.app](https://tomanote.app) ✨

## 🚀 What's new — v0.5.8

Offline-first foundations: connectivity awareness, resilient local persistence, and a fully hardened dependency tree.

### ✨ Features
- **Centralized connectivity state** — reactive `window.connectivity` store with clean subscriptions and a global `connectivity-changed` event
- **Connection status badge** — discrete toast on connection drops and recovery, with zero desktop layout shift
- **Offline save feedback** — autosave and Ctrl+S read "Saved locally (Offline mode active)" while offline (EN/ES)
- **Mobile link slash command** — typing " / " in the mobile editor opens the Link Insertion Modal (#107)
- **Instant persistence** — every edit reaches LocalStorage immediately; corrupt data degrades gracefully instead of blanking the app

### 🔒 Security
- **astro 7.3.5** — clears the critical AVIF image-optimization RCE and base-path authorization bypass (#110)
- **vitest / @vitest/mocker 4.1.11** — clears path traversal via redirect mock (CVE-2026-84373) (#109)
- **devalue 5.9.4** — clears DoS via malformed input (CVE-2026-81176) (#108)
- **`npm audit`: 0 active vulnerabilities** (down from 9)

### 🐛 Bug fixes
- **Custom font cascade** — note fonts now reach the ProseMirror editing surface (#104)
- **Autosave debounce** — keystrokes bubbling from the Milkdown surface correctly restart the 5 s countdown (#105)
- **Ctrl+S / Cmd+S** — case-insensitive matching for Chromium, ⌘S binding for macOS, immediate confirmation toast (#106)
- **Empty paragraphs after blocks** — fixed a silent off-by-one that skipped auto-inserted paragraphs (#85 regression)

### 🧪 Testing
- **920 total tests**: 761 unit (Vitest, 35 files) + 159 E2E (Playwright) — the E2E suite verified against the production build preview

## 📋 Previous: v0.5.7

Bug fixes, CI/CD hardening, info pages redesign, and link modal improvements.

- Code blocks render as true blocks (#84), empty paragraph after insertions (#85)
- Custom link modal replaces native `prompt()` (#87); links clickable via Ctrl/Cmd+click (#88)
- Keyboard shortcut dedup on init (#89); unified pin/unpin via TabPinHandler (#90, #91)
- Save indicator debounce fix (#92); responsive toolbar without clipping (#86)
- `/about`, `/privacy`, `/terms` redesigned with TomaNote design tokens
- **867 total tests**: 725 unit + 142 E2E

## 📋 Previous: v0.5.6

Milkdown editor integration, formatting toolbar, and UI cleanup.

### ✨ Features
- **Milkdown editor** — Full ProseMirror-based Markdown editor
- **GFM support** — Tables, images, links, code blocks via @milkdown/kit
- **Formatting toolbar** — 12 formatting buttons (bold, italic, headings, code, blockquote, lists, links)
- **Keyboard shortcuts** — Ctrl+B/I/U, Ctrl+Z/Y, Ctrl+S, 27 total registered
- **Auto-empty lines** — Automatic paragraphs around code blocks and blockquotes
- **Dual format** — Markdown (Milkdown) and HTML tabs coexist
- **56 Playwright E2E tests** across editor, UI, and persistence suites

## 🛠️ Tech Stack

- ![Astro](https://img.shields.io/badge/Astro-FF5D01?style=flat&logo=astro&logoColor=white)
- ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
- ![SCSS](https://img.shields.io/badge/SCSS-CC6699?style=flat&logo=sass&logoColor=white)
- ![TailwindCSS](https://img.shields.io/badge/Tailwind-38BFF8?style=flat&logo=tailwindcss&logoColor=white)

## 📦 Installation

### Use it online

1. Go to [tomanote.app](https://tomanote.app)
2. Start writing.

### Run it locally

```bash
# Clone the repo
git clone https://github.com/Tomanote/TomaNote.git

# Install dependencies
npm install

# Start dev server
npm run dev
```

## ⚠️ Important

- Notes are stored in your browser's LocalStorage
- Clearing your browser cache will delete your notes — back them up regularly
- No data is ever sent to external servers

## 🔒 Security

- Don't store sensitive information
- Data lives locally on your device
- No external data transmission

## 👥 Contributing

Contributions are welcome! You can help by:

- 🐛 Reporting or fixing bugs
- 💡 Suggesting new features
- 🔧 Submitting pull requests
- ⭐ Leaving a star on the repo

## 📄 License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).

Commercial use is prohibited without express written authorization. Contact me for commercial licensing.

## 📬 Contact & Links

- GitHub: [@camiicode](https://github.com/camiicode)
- Codepen: [@camiicode](https://codepen.io/camiicode)
- Instagram: [@camiicode](https://www.instagram.com/camiicoode/)
- Behance: [@camiicode](https://www.behance.net/camiicode)
- Portfolio: [camiicode.dev](https://camiicode.github.io/portfolio/)
- Twitch: [@camiicode](https://www.twitch.tv/c4mii_c)
- Email: [@mail.com](mailto:camiicoode@gmail.com)

## ☕ Support

If you find this useful and want to support its development:

<div align="center">
  <a href="https://buymeacoffee.com/dftp930" target="_blank">
    <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50px">
  </a>
</div>

---

<div align="center">
Made with ❤️ by <a href="https://github.com/camiicode">camiicode</a> @ <a href="https://mixxy.studio">Mixxy Studio</a>
</div>

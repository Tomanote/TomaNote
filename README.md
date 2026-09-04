# TomaNote — Free Online Notepad 📝

<div align="center">

![Version](https://img.shields.io/badge/version-0.5.6-blue.svg)
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

## 🚀 What's new — v0.5.6

Milkdown editor integration, syntax highlighting, formatting toolbar, and UI cleanup.

### ✨ New features
- **Milkdown editor** — Full ProseMirror-based Markdown editor replacing the legacy contenteditable system
- **GFM support** — Tables, images with upload, links, and code blocks via @milkdown/kit
- **Code block styling** — Polished code blocks with language labels, line numbers, and theme-aware colors
- **Formatting toolbar** — Right sidebar with 12 formatting buttons (bold, italic, underline, headings, code, blockquote, lists, links, horizontal rules)
- **Keyboard shortcuts** — Ctrl+B/I/U for formatting, Ctrl+Z/Y for undo/redo, Ctrl+S for save feedback
- **Auto-empty lines** — Automatic empty paragraphs around code blocks and blockquotes for better cursor positioning
- **Dual format support** — Markdown (Milkdown) and HTML (legacy) tabs coexist

### 🔧 Improvements
- **Code block styling** — Polished visual design with language labels, line numbers, and theme-aware colors
- **Editor UX** — Improved cursor behavior after blockquotes and code blocks
- **Bug fixes** — Fixed schema context key mismatch, stale state capture, and position validation errors

### 📦 Dependencies
- Added `@milkdown/kit` ^7.22.1, `@milkdown/plugin-tooltip` ^7.22.1, `@milkdown/theme-nord` ^7.22.1
- Removed `marked` (replaced by Milkdown)

### 🧪 Testing
- Added Playwright E2E testing with 56 tests across editor, UI, and persistence suites
- New test suites for autoEmptyLines plugin, floating menu Milkdown route, and code block formatting

### 🧪 Playwright E2E
- 25 editor tests: loading, typing, formatting, headings, code blocks, blockquotes, lists, links, undo/redo, tables, multi-tab
- 22 UI tests: sidebar, floating menu, bottom bar, modals, command palette, keyboard shortcuts help, context menu, tab switching
- 9 persistence tests: auto-save, localStorage, reload, multi-tab persistence, markdown recovery

### 🧪 Test coverage
723 total tests: 667 unit tests (Vitest) + 56 E2E tests (Playwright).

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

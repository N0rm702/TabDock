# TabDock 🚀 - Chrome Workspace & RAM Manager

**TabDock** is a lightweight, high-performance Google Chrome Extension (Manifest V3) designed to eliminate browser tab clutter, organize research workflows, and reclaim gigabytes of system memory (RAM).

Built for students, developers, and power users who work across multiple contexts simultaneously.

---

## ✨ Features

- ⚡ **RAM Reclamation:** Instantly close idling tabs to free up system memory for CPU-heavy tasks, compilers, and IDEs.
- 🎯 **Selective Tab Docking:** Choose exactly which open tabs to dock into a workspace using an interactive checklist.
- 🪟 **Flexible Restoration Modes:** Restore docked workspaces into a **New Window** or background tabs in the **Current Window**.
- 🔍 **All-in-One Popup Hub:** Access, search, restore, and delete all your saved workspaces directly from the extension toolbar popup — zero annoying redirects!
- 🎨 **Modern Light Aesthetic:** Clean, spacious Notion-style UI with soft shadows, high-contrast typography, and zero clutter.

---

## 🛠️ Tech Stack & Architecture

- **Manifest Version:** Chrome Extension Manifest V3
- **Frontend UI:** Vanilla JavaScript, HTML5, Vanilla CSS3 (Custom Properties & Flexbox/Grid)
- **Chrome Extension APIs:** `chrome.tabs`, `chrome.windows`, `chrome.storage.local`
- **Background Service Worker:** Asynchronous event listener lifecycle model

---

## 📦 Installation Guide (Developer Mode)

1. **Clone or Download** this repository to your computer.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. Select the `SAvingTabs` project folder.
6. Pin **TabDock** to your Chrome extension toolbar for instant access!

---

## 📖 License

Distributed under the MIT License. See `LICENSE` for more information.

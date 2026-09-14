# StorySaver - Instagram Story Downloader (Chrome Extension - Manifest V3)

A production-quality Chrome extension built with Manifest V3 that adds an intuitive, floating **Save** button to Instagram Stories on desktop (`https://www.instagram.com/*`). Download any Instagram story in full 1080p HD before it expires.

---

## Key Features

- **4-Tier Layered Extraction Engine**:
  - **Strategy 1 (Preferred)**: Scans and parses embedded JSON metadata (`video_versions`, `video_dash_manifest`, `image_versions2`, `display_resources`).
  - **Strategy 2 (DASH Manifest Regex Fallback)**: Extracts all escaped `.mp4` URLs from page source and selects the highest quality stream.
  - **Strategy 3 (Performance API Fallback)**: Queries recent media network requests (`fbcdn.net`) via resource entries.
  - **Strategy 4 (DOM Inspection Fallback)**: Fallback DOM inspection of `<video>` and `<img>` element sources/`srcset`.
- **Image vs Video Story Smart Detection**:
  - Detects image stories converted by Instagram into MP4 videos due to background music.
  - Prefers downloading the original high-resolution still image (`.jpg`) when metadata is available, avoiding lossy video conversion.
- **React SPA Seamless Navigation**:
  - Monitors URL history transitions (`pushState`, `replaceState`, `popstate`) and React DOM mutations (`MutationObserver`).
  - Automatically re-attaches the download button across story slides, user switches, and React re-renders.
- **Native Background Downloads**:
  - Sends media URLs directly to the background service worker using `chrome.downloads.download()`.
  - Zero CORS issues, no `fetch()` bloat, no Blob conversions, and no canvas hacks.
- **Smart Filename Generation**:
  - Format: `storysaver_{username}_{YYYY-MM-DD}.mp4` or `storysaver_{username}_{YYYY-MM-DD}.jpg`.

---

## Directory Structure

```
instagram_story_downloader/
├── manifest.json            # Manifest V3 extension configuration (StorySaver)
├── background.js           # Service worker handling chrome.downloads API calls
├── content.js              # Orchestrator content script & UI button renderer
├── inject.js               # Main-world script for page performance monitoring
├── utils/
│   ├── parser.js           # 4-strategy media extraction & quality sorting logic
│   ├── downloader.js       # Background message router & filename generator
│   └── observer.js         # React SPA navigation & MutationObserver watcher
├── styles.css              # Custom styling, spinner animations & toast notifications
├── icons/
│   ├── icon.svg            # Base vector graphic icon
│   ├── generate_icons.py   # Python icon generator script
│   ├── icon16.png          # 16x16 toolbar icon
│   ├── icon48.png          # 48x48 extension manager icon
│   └── icon128.png         # 128x128 store/details icon
└── README.md               # Documentation & setup guide
```

---

## Installation Instructions

1. Open **Google Chrome** (or Brave, Edge, Opera, or any Chromium-based browser).
2. Navigate to `chrome://extensions/` in your address bar.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click the **Load unpacked** button in the top-left menu.
5. Select the project folder:
   `/Users/sagalpreet/Documents/Github-Projects/projects/instagram_story_downloader`
6. The extension is now active!

---

## Usage

1. Open [Instagram](https://www.instagram.com/) on desktop.
2. Click on any user's **Story**.
3. You will see a sleek **Save** button located at the top of the Story viewer header.
4. Click **Save**:
   - The button will display a spinning indicator (`Saving...`).
   - The highest quality media file will automatically save to your computer's downloads folder.
   - A success toast notification will confirm download initiation (`Saved story @username!`).
5. Move to the next/previous story or switch users — the button will adapt dynamically without requiring a page reload.

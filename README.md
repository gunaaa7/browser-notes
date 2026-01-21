# PageNote

Friction-free notes attached to web pages. Your notes resurface automatically when you revisit a page.

---

## Demo

![PageNote demo](PageNote - Demo.gif)

---

## Features

- Instant capture: open the side panel from any page and start typing
- Auto-resurface: notes show up again on return visits
- URL canonicalization: handles URL variations and YouTube video IDs
- SPA-aware: detects route changes in single-page apps
- Auto-save: debounced saves while you type
- Local-only storage: notes stay on your device (no cloud sync)
- Export + quota status: export all notes and monitor storage usage
- Badge indicator: shows when a page has a saved note

---

## Install (Local / Development)

1. Open Chrome and go to `chrome://extensions/`
2. Enable Developer mode
3. Click Load unpacked
4. Select the `src` folder from this project

---

## Usage

- Open the side panel with `Alt+S` (default) or the toolbar button
- Write your note; it auto-saves
- Close the panel with the X button or `Alt+S`
- Open the dashboard to view/export notes (extension options page)

You can change the shortcut at `chrome://extensions/shortcuts`.

---

## Project Structure

```
src/
  manifest.json     # Extension manifest
  background.js     # Service worker (storage, canonical URLs, badge)
  content.js        # SPA route detection
  sidepanel.html    # Side panel UI
  sidepanel.js      # Side panel logic
  dashboard.html    # Notes dashboard (options page)
  dashboard.js      # Dashboard logic (list/export)
  icons/            # Extension icons
```

---

## Privacy & Storage

- Uses Chrome local storage only
- No external requests or analytics
- Approximate quota: 5MB total for all notes

---

## Development Notes

- Canonicalization removes tracking params and normalizes URLs
- YouTube notes key off the video ID for consistent resurfacing
- SPA route changes are detected with debounced observers

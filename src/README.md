# sideNote - Chrome Extension

> Friction-free note-taking directly inside any web page. Your notes resurface automatically on every visit.

## Features

- **Zero-friction capture**: Press Alt+N or click the toolbar button to open the note panel
- **Automatic resurfacing**: Notes appear automatically when you revisit a page
- **Smart URL handling**: Works with SPAs, YouTube videos, and handles URL variations
- **Auto-save**: Notes save automatically with 400ms debounce
- **Privacy-first**: All data stays on your device, no cloud sync required
- **Storage management**: Built-in quota monitoring and export functionality
- **Visual feedback**: Badge indicator shows when notes exist for the current page

## Installation

### From Source (Development)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `src` folder
5. The extension will be installed and ready to use

### From Chrome Web Store

*Coming soon - extension will be published to the Chrome Web Store*

## Usage

### Creating Notes

1. **Open panel**: Press `Alt+N` or click the sideNote toolbar button
2. **Start typing**: The panel opens with a text area ready for your notes
3. **Auto-save**: Notes save automatically as you type (400ms debounce)
4. **Close panel**: Click the **X** button in the top-right corner of the panel

### Managing Notes

- **View existing notes**: Notes automatically appear when you revisit a page
- **Edit notes**: Simply click in the text area and start editing
- **Delete notes**: Click the "Clear" button to permanently delete a note
- **Export notes**: Click "Export" to download all your notes as JSON

### Keyboard Shortcuts

- `Alt+N` - Open side panel from any webpage, or save current note from within the panel  
- `Ctrl+S` or `Cmd+S` - Force save current note (works in side panel)
- Click the **X** button in the top-right corner to close the side panel

## How It Works

### URL Canonicalization

sideNote creates consistent URLs by:
- Forcing HTTPS
- Converting hostnames to lowercase
- Removing tracking parameters (utm_*, fbclid, gclid)
- Removing trailing slashes and /index.html
- Special handling for YouTube videos (youtube:VIDEO_ID)

### Storage

- Uses Chrome's local storage (≈5MB quota)
- No external servers or cloud sync
- All data stays on your device
- Storage quota monitoring with warnings

### SPA Support

- Detects route changes in Single Page Applications
- Monitors URL changes, DOM mutations, and history API calls
- Debounced change detection to avoid excessive processing

## Data Model

Each note contains:
```json
{
  "id": "https://example.com/page",
  "title": "example.com/page",
  "created": "2024-01-01T00:00:00.000Z",
  "updated": "2024-01-01T00:00:00.000Z",
  "content": "Your note content here...",
  "aliases": ["http://example.com/page"]
}
```

## File Structure

```
src/
├── manifest.json          # Extension manifest
├── background.js          # Service worker
├── content.js            # Content script for SPA detection
├── sidepanel.html        # Side panel UI
├── sidepanel.js          # Side panel logic
├── icons/                # Extension icons
│   └── README.md         # Icon requirements
└── README.md             # This file
```

## Development

### Key Components

1. **Service Worker** (`background.js`)
   - URL canonicalization
   - Storage management
   - Badge updates
   - Message handling

2. **Content Script** (`content.js`)
   - SPA route change detection
   - URL change notifications
   - DOM mutation monitoring

3. **Side Panel** (`sidepanel.html` + `sidepanel.js`)
   - Note editing interface
   - Auto-save functionality
   - Storage quota monitoring
   - Export/import features

### Testing

Test the extension on various sites:
- Regular websites
- Single Page Applications (React, Vue, Angular)
- YouTube videos
- Sites with tracking parameters
- Sites with different URL structures

## Privacy & Security

- **No external requests**: All data stays on your device
- **No tracking**: No analytics or user tracking
- **No cloud sync**: Uses Chrome's local storage only
- **No permissions abuse**: Only requests necessary permissions
- **Open source**: Code is transparent and auditable

## Browser Support

- Chrome 88+ (Manifest V3 support)
- Microsoft Edge 88+ (Chromium-based)
- Other Chromium-based browsers with Manifest V3 support

## Contributing

1. Fork the repository
2. Make your changes
3. Test thoroughly on different websites
4. Submit a pull request

## License

MIT License - feel free to use, modify, and distribute.

## Support

For issues or questions:
1. Check the browser console for errors
2. Verify permissions are granted
3. Test on different websites
4. Report issues with specific URLs and error messages

## Roadmap

Future features being considered:
- Cross-device sync
- Note tags and categories
- Rich text editing
- Note templates
- Team sharing capabilities
- AI-powered note suggestions

---

**Made with ❤️ for knowledge workers who want friction-free note-taking.** 
cookie-decliner-extension/
  ├── manifest.json (extension configuration)
  ├── background.js (service worker for background tasks)
  ├── content.js (script that runs on web pages)
  ├── popup.html (extension popup UI)
  ├── popup.js (popup logic)
  ├── styles.css (styling)
  └── icons/ (extension icons in different sizes)

  # Cookie Auto Decliner - Chrome Extension

Automatically decline cookie consent banners and close popups to improve your browsing experience.

## Features

✅ **Automatic Detection** - Detects cookie banners from major consent frameworks (OneTrust, Cookiebot, Quantcast, etc.)  
✅ **Smart Declining** - Intelligently finds and clicks "Decline All" or "Necessary Only" buttons  
✅ **Multi-language Support** - Works with banners in English, Spanish, French, German, Italian, Dutch, and Portuguese  
✅ **Manual Trigger** - Scan for banners on-demand with one click  
✅ **Whitelist Domains** - Disable auto-decline for specific websites  
✅ **Statistics Tracking** - See how many banners you've declined  
✅ **Lightweight** - Minimal performance impact on browsing  

## Installation

### Method 1: Load Unpacked (Development)

1. **Download the extension**
   - Clone or download this repository to your computer

2. **Open Chrome Extensions**
   - Navigate to `chrome://extensions/`
   - Or click Menu (⋮) → More Tools → Extensions

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the extension**
   - Click "Load unpacked"
   - Select the `cookie-decliner-extension` folder
   - The extension should now appear in your extensions list

5. **Pin the extension** (Optional)
   - Click the puzzle icon (🧩) in the Chrome toolbar
   - Find "Cookie Auto Decliner" and click the pin icon

### Method 2: Chrome Web Store (Coming Soon)

The extension will be available on the Chrome Web Store soon.

## Usage

### Basic Usage

1. **Automatic Mode** (Default)
   - The extension works automatically on all websites
   - Cookie banners are detected and declined within seconds
   - A badge on the extension icon shows the count

2. **Manual Scan**
   - Click the extension icon to open the popup
   - Click "Scan Now" to manually check for banners
   - Useful if a banner appears after you've loaded the page

3. **Enable/Disable**
   - Click the extension icon
   - Toggle the "Enable Auto Decline" switch
   - Changes apply immediately to all tabs

### Settings

Click the "Settings" link in the popup to access advanced options:

- **Enable Extension** - Turn the extension on/off globally
- **Show Notifications** - Display a notification when banners are declined
- **Whitelist Domains** - Add domains where banners should NOT be auto-declined
- **Statistics** - View total banners declined and reset stats

## How It Works

### Detection Methods

1. **Known Selectors** - Matches against a database of common cookie banner frameworks
2. **High Z-Index** - Identifies popup elements with high z-index values
3. **Keyword Detection** - Searches for cookie-related keywords in visible elements
4. **Dynamic Monitoring** - Uses MutationObserver to detect banners loaded after page load

### Decline Strategies

The extension tries multiple strategies in order:

1. Find and click "Reject All" / "Decline" buttons
2. Find and click "Necessary Only" / "Essential Only" buttons
3. Find and click close buttons
4. Directly remove the banner from the DOM (last resort)

After declining, it also:
- Removes overlay/backdrop elements
- Restores page scrolling if disabled
- Updates statistics

## File Structure

```
cookie-decliner-extension/
├── manifest.json              # Extension configuration
├── background/
│   └── background.js         # Service worker
├── content/
│   ├── content.js            # Main content script
│   └── content.css           # Injected styles
├── scripts/
│   ├── selectors.js          # Selector database
│   ├── detector.js           # Detection logic
│   └── decliner.js           # Decline logic
├── popup/
│   ├── popup.html            # Extension popup
│   ├── popup.js              # Popup logic
│   └── popup.css             # Popup styles
├── options/
│   ├── options.html          # Settings page
│   ├── options.js            # Settings logic
│   └── options.css           # Settings styles
└── icons/                    # Extension icons
```

## Development

### Prerequisites

- Google Chrome or Chromium-based browser
- Basic knowledge of JavaScript and Chrome Extension APIs

### Testing

1. Load the extension in developer mode (see Installation)
2. Open Chrome DevTools (F12) on any webpage
3. Check the Console tab for log messages:
   - `Cookie Auto Decliner: Initialized`
   - `Found X cookie banner(s)`
   - `Cookie banner declined successfully`

### Debugging

- **Content Script**: Right-click on page → Inspect → Console
- **Popup**: Right-click on extension icon → Inspect popup
- **Background Script**: chrome://extensions/ → Background page (inspect views)
- **Options Page**: Right-click on options page → Inspect

### Adding New Selectors

Edit `scripts/selectors.js` to add new cookie banner selectors:

```javascript
containers: [
  '#your-cookie-banner-id',
  '.your-cookie-banner-class',
  // ... more selectors
]
```

## Troubleshooting

### Extension not working

1. **Refresh the page** - The extension only loads when a page is loaded
2. **Check if enabled** - Open the popup and ensure the toggle is ON
3. **Check whitelist** - Make sure the domain isn't whitelisted
4. **Clear cache** - Try clearing browser cache and reloading

### Banner not detected

Some banners use unique implementations. You can:
1. Use the "Scan Now" button to trigger manual detection
2. Report the website URL (see Contributing section)
3. Add custom selectors in the code

### Banner detected but not declined

This can happen if:
- The banner uses non-standard button labels
- JavaScript events prevent clicking
- The banner is inside an iframe
- Anti-automation measures are in place

## Privacy

This extension:
- ✅ Does NOT collect any personal data
- ✅ Does NOT track browsing history
- ✅ Does NOT send data to external servers
- ✅ Stores settings locally only
- ✅ Works entirely offline

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Reporting Issues

When reporting a website where the extension doesn't work:
- Provide the URL
- Describe the cookie banner (screenshot helpful)
- Check browser console for errors
- Note your browser version

## Roadmap

- [ ] Support for more cookie frameworks
- [ ] Custom user-defined rules
- [ ] Import/export settings
- [ ] Per-domain statistics
- [ ] Firefox and Edge versions
- [ ] Sync settings across devices

## License

MIT License - See LICENSE file for details

## Credits

Developed by [Your Name]

## Support

- 🐛 Report bugs: [GitHub Issues]
- 💡 Feature requests: [GitHub Issues]
- ⭐ Star the project if you find it useful!

---

**Note**: This extension is provided as-is. While it aims to decline cookie banners automatically, it cannot guarantee 100% effectiveness on all websites. Always review your privacy settings on websites you care about.
# Salesforce Easy Navigation Extension

A Chrome extension that enhances Salesforce navigation by extracting and organizing setup menu links, managing Object Manager items, and providing quick access to admin features.

_Note: This extension was built mainly for personal use, so it may not be fully polished, but it works well for me—feel free to use and modify it as needed._

## Features

- **Quick Navigation**: Single-click the button to navigate between Setup and Home pages. Double-click to open the navigation modal.
- **Setup Links Tab**: Browse all Salesforce setup menu items organized alphabetically with search and filtering
- **Object Manager Tab**: Access all Salesforce objects with quick search and navigation
- **Login As User Tab**: Search and login as other users (admin feature)
- **Record ID Navigation**: Quickly navigate to any record by entering its ID
- **Pin Favorites**: Pin frequently used links and objects for quick access
- **Persistent Cache**: Links and objects are cached locally for fast subsequent access
- **Smart Extraction**: Automatically extracts all setup links by expanding the navigation tree

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked**
4. Select the extension folder

## Usage

### Button Actions

| Action           | Description                                          |
| ---------------- | ---------------------------------------------------- |
| **Single Click** | Navigate to Home (if on Setup) or Setup (if on Home) |
| **Double Click** | Open the navigation modal                            |
| **Triple Click** | Extract and cache all setup links                    |
| **Ctrl+Click**   | Open navigation target in a new tab                  |

### Initial Extraction

When you login to an org for the first time after installing the extension, it has to first extract and cache all setup links and object links.
To cache setup links, navigate to the Setup page and either double-click or triple-click the extension button. Wait for a minute approximately for the extraction to complete without navigating away from the page with the tab in focus.
To cache object links, navigate to the Object Manager page and either double-click or triple-click the extension button. Wait till the page stops scrolling automatically.
The cached links expire in 60 days now, its hardcoded, you can easily edit the code to change the expiry duration.

### Navigation Modal Tabs

1. **Setup Links**: Browse all Salesforce setup menu items organized alphabetically with parent categories
2. **Object Manager**: Search and navigate to Salesforce objects
3. **Login As User**: Search active users by name, email, or username to login as them

### Record ID Navigation

Enter a 15 or 18-character Salesforce record ID in the input field and press Enter or click "Go to Record" to navigate directly to that record.

### Pinning Items

Click the pin icon (📌) next to any link or object to pin it. Pinned items appear at the top of the list and are persisted across sessions.

## Permissions

This extension requires the following permissions:

- **activeTab**: Access the current tab's URL and content
- **scripting**: Execute content scripts
- **storage**: Store cached links and user preferences locally
- **cookies**: Retrieve Salesforce session ID for API calls

## Supported URLs

The extension works on Salesforce Lightning URLs:

- `*://*.lightning.force.com/*`
- `*://*.my.salesforce.com/*`
- `*://*.my.salesforce-setup.com/*`

## Architecture

```
sf-gohome-extn/
├── manifest.json          # Chrome Extension V3 configuration
├── content.js            # Main extension logic (~1100 lines)
├── background.js         # Service worker for message passing
├── styles.css            # Button styling
├── modal.css             # Modal UI styling
├── AGENTS.md             # Development guidelines
└── icons/
    ├── icon16.jpeg
    └── icon48.jpeg
```

### Key Components

- **content.js**: Handles DOM manipulation, link extraction, modal UI, and all user-facing features
- **background.js**: Service worker that handles message passing and session cookie retrieval
- **Chrome Storage**: Used for caching extracted links, objects, and pinned items per domain

### Storage Keys

- `sf-setup-links-{domain}-links`: Cached setup links
- `sf-setup-links-{domain}-objects`: Cached Object Manager objects
- `sf-setup-links-{domain}-pinned-links`: Pinned setup links
- `sf-setup-links-{domain}-pinned-objects`: Pinned objects
- `sf-setup-links-{domain}-updated`: Last cache update timestamp

## Development

### Running in Development

1. Load the extension in Chrome (see Installation)
2. Make changes to source files
3. Reload the extension on `chrome://extensions/`
4. Test on a Salesforce instance

### Console Logging

The extension uses descriptive console logging with context. Check the browser console when troubleshooting:

- `console.log`: General operation messages
- `console.error`: Errors and exceptions
- `console.warn`: Non-critical warnings

### Cache Invalidation

- Setup links cache expires after 20 days
- Objects cache expires after 60 days
- Double-click the button while on the appropriate page to force refresh

## Browser Support

Tested on Google Chrome (Extension Manifest V3).

## License

MIT License

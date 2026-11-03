# Salesforce Easy Navigation Extension

A Chrome & Firefox extension that enhances Salesforce navigation by extracting and organizing setup menu links, managing Object Manager items, and providing quick access to admin features.

## Motivation

I built this mainly because I found navigating to the setup tab and back quite tedious. Setup always opens in a new tab, and going back to the home page from setup requires opening the app launcher or finding the original tab. A secondary annoyance was the quick find box in setup being a bit sluggish and rigid for my liking. I also added object search (similarly sluggish). "Login As User" was added later since that's something else I frequently use, and finding a user in the standard UI is also a sub-par experience.

## Features

- **Quick Navigation**: Single-click button to navigate between Setup and Home pages. Hover over button for 1 second to open the navigation modal.
- **Hover-Based Interactions**: Hover over tabs for 50ms to switch between them, reducing clicks and improving efficiency
- **Setup Links Tab**: Browse all Salesforce setup menu items organized alphabetically with search and filtering
- **Object Manager Tab**: Access all Salesforce objects with quick search and navigation
- **Object Quick Links**: Direct access to Fields, Validation Rules, Page Layouts, Record Types, Lightning Pages, Buttons & Actions, Field Sets, and Compact Layouts for each object
- **Field Search**: Type `Object.field` (e.g. `Account.ind`, `Opp.stg`) in the Object Manager tab to find a field and open its setup page. Matches labels and API names, including fuzzy matches
- **Metadata Tab**: Pick a metadata type (Apex classes and triggers, Flows, Lightning web and Aura components, permission sets and groups, profiles, custom labels, custom metadata types, Visualforce pages, static resources, validation rules) and search it by name; results open the item's setup page
- **Login As User Tab**: Search and login as other users (admin feature)
- **Record ID Navigation**: Quickly navigate to any record by entering its ID
- **Production Warning**: In production orgs the button turns red, its tooltip says "PRODUCTION org", and the modal shows a PRODUCTION badge. Sandboxes, Developer Edition and scratch orgs keep the normal blue (detected from the hostname)
- **Pin Favorites**: Pin frequently used links and objects for quick access
- **Persistent Cache**: Links and objects are cached locally for fast subsequent access
- **Smart Extraction**: Automatically extracts all setup links by expanding the navigation tree
- **Memory Efficient**: Proper cleanup of event listeners and timers prevents memory leaks

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked**
4. Select the extension folder

## Usage

### Button Actions

| Action            | Description                                          |
| ----------------- | ---------------------------------------------------- |
| **Single Click**  | Navigate to Home (if on Setup) or Setup (if on Home) |
| **Hover (1s)**    | Open the navigation modal                            |
| **Ctrl+Click**    | Open navigation target in a new tab                  |

### Hover-Based Tab Switching

Once the navigation modal is open, simply hover over any tab for 50ms to switch to it. This reduces the number of clicks needed to access different features. Clicking tabs still works for immediate switching.

### Initial Extraction

When you login to an org for the first time after installing the extension, it has to first extract and cache all setup links and object links. Extraction starts automatically when you open the modal (hover the button) on the right page and the cache is empty or expired:

- **Setup links**: Go to any Setup page and hover the button. The extension expands the Setup menu tree and collects every link. This takes about a minute; stay on the page with the tab in focus until the "Extracting more links..." indicator disappears.
- **Objects**: Go to Object Manager and hover the button. The object list scrolls automatically; wait until it stops.

To re-extract at any time, use the **🔄 Refresh** button on the relevant tab while on the matching page. Cached links and objects expire after 60 days (`CACHE_EXPIRY_DAYS` in `content/constants.js`).

### Navigation Modal Tabs

1. **Setup Links**: Browse all Salesforce setup menu items organized alphabetically with parent categories
2. **Object Manager**: Search and navigate to Salesforce objects with direct access to specific setup sections. Type `Object.field` to search that object's fields instead:
   - The object part matches an object's label or API name (`Account`, `opp`, `Order_Line_Item__c`); if several match, pick one from the suggestions
   - The field part matches field labels and API names: exact, prefix, contains, then fuzzy (`clsdt` finds Close Date)
   - Fields are fetched live (one query per object, about 150ms) and kept only in memory while the modal is open; nothing is stored
3. **Login As User**: Search active users by name, email, or username to login as them. Users are queried live from Salesforce on every search and never stored in the browser; with an empty search, the tab shows users you recently logged in as, then the most recently active users

4. **Metadata**: Click a type chip, then type in the search box. Each search runs one live query for the selected type (up to 50 results, ranked exact, prefix, then contains) and nothing is cached. Results open the item's setup page; Flows open the flow's detail page listing all versions. For validation rules, type `Object.rule` (e.g. `Account.status`, or `Account.` for all of an object's rules) to search one object's rules; the object is matched the same way as in field search

### Record ID Navigation

Enter a 15 or 18-character Salesforce record ID in the input field and press Enter or click "Go to Record" to navigate directly to that record.

### Pinning Items

Click the pin icon (📌) next to any link or object to pin it. Pinned items appear at the top of the list and are persisted across sessions.

## Permissions

This extension requires the following permissions:

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
├── content/              # Modular content script sources
│   ├── constants.js      # Shared ids, paths, timings
│   ├── state.js          # Runtime state + timers
│   ├── storage.js        # Cache + pin utilities
│   ├── api.js            # Salesforce REST helpers
│   ├── users.js          # Login-as data fetching/render
│   ├── renderers.js      # Setup/object list UI builders
│   ├── fields.js         # Object.field search (live, in-memory only)
│   ├── metadata.js       # Metadata tab: per-type live search
│   ├── modal.js          # Modal assembly + navigation
│   ├── objects.js        # Object Manager extraction
│   ├── button.js         # Floating button orchestration
│   ├── extraction.js     # Async setup link crawling
│   └── init.js           # Bootstrapping + listeners
├── background.js         # Service worker for session cookie lookup
├── build.sh              # Builds dist/chrome and dist/firefox
├── styles.css            # Button styling
├── modal.css             # Modal UI styling
├── AGENTS.md             # Development guidelines
└── icons/
    ├── icon16.jpeg
    └── icon48.jpeg
```

### Key Components

- **content/**: Modular content scripts that handle DOM manipulation, link extraction, modal UI, object quick links, login-as flows, and all user-facing features
- **background.js**: Service worker that retrieves the Salesforce session cookie for REST calls (content scripts can't read cookies directly)
- **Chrome Storage**: Used for caching extracted links, objects, and pinned items per domain

### Storage Keys

- `sf-setup-links-{domain}-links`: Cached setup links
- `sf-setup-links-{domain}-objects`: Cached Object Manager objects
- `sf-setup-links-{domain}-pinned-links`: Pinned setup links
- `sf-setup-links-{domain}-pinned-objects`: Pinned objects
- `sf-setup-links-{domain}-updated`: Last cache update timestamp (setup links)
- `sf-setup-links-{domain}-objects-updated`: Last cache update timestamp (objects)
- `sf-setup-links-{domain}-recent-users`: IDs of up to 10 recently impersonated users (not cleared with cache bust)

## Development

### Customizing Hover Delays

Adjust hover interaction timings inside `content/constants.js`:

- `BUTTON_HOVER_DELAY_MS` (default: 1000ms): Time to hover over button before opening modal
- `TAB_HOVER_DELAY_MS` (default: 50ms): Time to hover over tab before switching

### Running in Development

1. Load the extension in Chrome (see Installation)
2. Make changes to source files
3. Reload the extension on `chrome://extensions/`
4. Test on a Salesforce instance

### Building for Chrome and Firefox

Run `./build.sh` (or `npm run build`; needs Node.js). It writes two loadable copies to `dist/` (gitignored):

- `dist/chrome`: the manifest declares only `background.service_worker`, so Chrome shows no warning. Load it from `chrome://extensions/` with **Load unpacked**.
- `dist/firefox`: the manifest declares only `background.scripts` and adds the `browser_specific_settings.gecko` add-on ID (Firefox 128+). Load it from `about:debugging#/runtime/this-firefox` with **Load Temporary Add-on…** and pick `dist/firefox/manifest.json`. If the button doesn't appear, allow the Salesforce sites under the add-on's **Permissions** in `about:addons`.

The build copies the source files, rewrites the manifest per browser, fails if the manifest points at a missing file, and syntax-checks every script. Rerun it after each change.

### Console Logging

The extension uses descriptive console logging with context. Check the browser console when troubleshooting:

- `console.log`: General operation messages
- `console.error`: Errors and exceptions
- `console.warn`: Non-critical warnings

### Cache Invalidation

- Setup links cache expires after 60 days
- Objects cache expires after 60 days
- Users are not cached; Login As searches query Salesforce live (data stored by older versions is deleted on load)
- Use the **🔄 Refresh** button on each tab to force a refresh (setup links and objects must be refreshed from Setup and Object Manager respectively)

## Browser Support

Tested on Google Chrome (Extension Manifest V3).
Tested on Firefox (Extension Manifest V3).

**Note:** Chrome shows the warning `'background.scripts' requires manifest version of 2 or lower` when loading the extension. This is expected and harmless. `manifest.json` declares both `background.service_worker` (used by Chrome) and `background.scripts` (used by Firefox, which doesn't support MV3 service workers), and each browser ignores the key it doesn't use. Don't remove `background.scripts`, or Firefox support will break. To avoid the warning, load `dist/chrome` from `./build.sh` instead.

## License

MIT License

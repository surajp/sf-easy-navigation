# AGENTS.md

This file provides guidance for AI agents working on the sf-gohome-extn Chrome extension project.

## Build and Test Commands

This project has no build, lint, or test infrastructure configured. The package.json only contains a placeholder test command.

To manually test the extension:
1. Load the extension in Chrome (chrome://extensions -> Developer mode -> Load unpacked)
2. Navigate to a Salesforce instance (*://*.lightning.force.com/*)
3. Verify functionality manually

## Project Overview

Chrome extension that enhances Salesforce navigation by extracting and organizing setup menu links alphabetically, managing Object Manager items, allowing users to pin items, providing search/filter functionality, and adding record ID navigation.

## Code Structure

Flat file structure: `manifest.json` (Chrome Extension V3 config), `background.js` (service worker), `content.js` (main logic ~840 lines), `styles.css`, `modal.css`, `icons/`

## Naming Conventions

Constants: `UPPER_SNAKE_CASE` (BUTTON_ID, MODAL_ID, SETUP_PATH_REGEX)
Functions: `camelCase` (createButton, handleDoubleClick, updateButtonState)
Variables: `camelCase` (currentButton, clickCount), prefix private vars with `_` (_pinnedLinks)
CSS classes: `sf-*` prefix with kebab-case (.sf-go-home-setup-button, .sf-setup-tag-cloud-modal)

## JavaScript Patterns

Async/Await: Use for all Chrome API calls, wrap JSON.parse in try-catch with fallback defaults
Error Handling: try-catch-finally with descriptive error messages and console.error
DOM Manipulation: createElement, classList.add, querySelector/querySelectorAll
Event Handling: addEventListener over inline onclick, use event.preventDefault() for link navigation
Chrome Storage: Stringify data before storage, use computed property names [key], parse after retrieval
Message Passing: Use action field for message type, data field for payload, stringify complex data

## CSS Guidelines

Z-index: 9999 for main button, 10000 for modals
Responsive: Media queries at 768px breakpoint
Branding: Use Salesforce blue (#0070d2) as primary color
Prefixing: All custom CSS classes use sf- prefix to avoid conflicts

## Console Logging

Descriptive messages with context, console.error for errors, console.warn for non-critical warnings, include relevant data in logs

## Code Comments

Use `---` separators for major sections, keep concise and meaningful, explain "why" not "what" for complex logic

## Salesforce DOM Work

Selectors: Use data attributes (data-placement), slds-* classes, query from appropriate parent
Scrolling: Detect completion by comparing scroll positions, use delays for DOM updates, handle dynamic loading

## Extension Architecture

Content Script (content.js): DOM interaction, link extraction/caching, modal UI, all user-facing logic (including Login As User tab)
Background Script (background.js): Message passing, cookie/session retrieval for Login As feature
Storage Keys: sf-setup-links-{domain}-links, -objects, -pinned-links, -pinned-objects, -updated, -objects-updated

## Login As User Feature

- Modal now has a third tab titled **"Login As User"** that lets admins search active users (debounced input, 50 results sorted by last login or name)
- Content script retrieves Salesforce data via REST (`/services/data/vXX/query`) using the browser session ID
- Session ID is obtained by messaging `background.js`, which calls `chrome.cookies.get({ url: https://<my.salesforce.com domain>, name: "sid" })`
- Background derives the correct My Domain via `getSalesforceDomainFromUrl` (handles `lightning.force.com` → `my.salesforce.com` and setup domains)
- Navigation uses `https://<instance>/servlet/servlet.su?oid=<orgId>&suorgadminid=<selectedUserId>&retURL=<path>&targetURL=<path>` and closes the modal after redirect
- `manifest.json` must include the `cookies` permission for this flow; keep it in sync if permissions change
- Any future REST calls should reuse the cached session ID helper to avoid redundant cookie lookups and handle error messaging consistently
- Track recently impersonated users per domain in chrome.storage.local using the `sf-setup-links-{domain}-recent-users` key, keeping the most recent logins first with no duplicates. Never clear this cache when busting other storage keys, and always handle missing or malformed cache data gracefully.

## Copilot Guidelines (from .github/copilot-instructions.md)

- Use descriptive variable names
- Follow standards and best practices for writing clean and maintainable code
- Keep code modular, suggest splitting into multiple files if necessary
- Keep new code consistent with existing code in terms of naming and design patterns

## When Adding New Features

Follow existing patterns in content.js, use sf- prefix for CSS classes, add error handling for Chrome API calls, consider cache invalidation, test on different Salesforce pages, ensure responsive design, add console logging for debugging

## File Modification Priorities

content.js (main logic), modal.css (UI/responsive), manifest.json (permissions/config only), background.js (message handling only), styles.css (main button only)

## Anti-Patterns to Avoid

Inline event handlers, deep nesting in extraction logic, blocking main thread, global pollution, duplicate code

This is a simple Chrome extension without a build pipeline. Keep it straightforward - no bundlers, no TypeScript, no complex tooling unless absolutely necessary.

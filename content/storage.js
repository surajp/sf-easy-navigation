/********* content/storage.js **************/
async function retrieveOrCreateLinksCache() {
  const key = KEY_BASE + "-links";
  let linksCache = (await chrome.storage.local.get([key]))[key];
  try {
    linksCache = linksCache ? JSON.parse(linksCache) : {};
  } catch (e) {
    console.error("Error parsing links cache from localStorage", e);
    linksCache = {};
  }
  return linksCache;
}

async function retrieveOrCreateObjectsCache() {
  const key = KEY_BASE + "-objects";
  let objectsCache = (await chrome.storage.local.get([key]))[key];
  try {
    objectsCache = objectsCache ? JSON.parse(objectsCache) : {};
  } catch (e) {
    console.error("Error parsing objects cache from localStorage", e);
    objectsCache = {};
  }
  return objectsCache;
}

async function retrieveOrCreateRecentUsersCache() {
  const key = KEY_BASE + "-recent-users";
  let recentUsers = (await chrome.storage.local.get([key]))[key];
  try {
    recentUsers = recentUsers ? JSON.parse(recentUsers) : null;
  } catch (e) {
    console.error("Error parsing recent users cache from localStorage", e);
    recentUsers = null;
  }
  if (!recentUsers || !Array.isArray(recentUsers) || recentUsers.length === 0) {
    recentUsers = [];
  }
  _recentUsers = recentUsers;
  return recentUsers;
}

async function updateRecentUsers(userId) {
  const key = KEY_BASE + "-recent-users";
  let recentUsers = await retrieveOrCreateRecentUsersCache();
  const index = recentUsers.indexOf(userId);
  if (index > -1) {
    recentUsers.splice(index, 1);
  }
  recentUsers.unshift(userId);
  _recentUsers = recentUsers.slice(0, MAX_RECENT_USERS);
  await chrome.storage.local.set({
    [key]: JSON.stringify(_recentUsers),
  });
}

// --- Legacy users cache cleanup ---
// Earlier versions stored up to 5000 users (names, usernames, emails) in chrome.storage.
// Users are now queried live, so delete that data. Recent-user IDs are kept on purpose.
async function removeLegacyUsersCache() {
  try {
    await chrome.storage.local.remove([KEY_BASE + "-users", KEY_BASE + "-users-updated"]);
  } catch (error) {
    console.error("Error removing legacy users cache from storage", error);
  }
}

async function saveLinksCache(linksCache, allDone = false) {
  const linksKey = KEY_BASE + "-links";
  const tsKey = KEY_BASE + "-updated";
  await chrome.storage.local.set({
    [linksKey]: JSON.stringify(linksCache),
  });
  if (allDone) {
    await chrome.storage.local.set({
      [tsKey]: Date.now().toString(),
    });
  }
}

async function saveObjectsCache(objectsCache, allDone = false) {
  const objectsKey = KEY_BASE + "-objects";
  const tsKey = KEY_BASE + "-objects-updated";
  await chrome.storage.local.set({
    [objectsKey]: JSON.stringify(objectsCache),
  });
  if (allDone) {
    await chrome.storage.local.set({
      [tsKey]: Date.now().toString(),
    });
  }
}

function isCacheStale(lastUpdatedTimestamp) {
  if (!lastUpdatedTimestamp) return true;
  const now = Date.now();
  const maxAge = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return now - lastUpdatedTimestamp > maxAge;
}

async function shouldRefreshObjectsCache() {
  const key = KEY_BASE + "-objects-updated";
  const objectsCache = await retrieveOrCreateObjectsCache();
  if (Object.keys(objectsCache).length === 0) {
    return true;
  }
  const lastUpdated = (await chrome.storage.local.get([key]))[key];
  return isCacheStale(lastUpdated);
}

async function shouldRefreshCache() {
  const key = KEY_BASE + "-updated";
  const linksCache = await retrieveOrCreateLinksCache();
  if (Object.keys(linksCache).length === 0) {
    return true;
  }
  const lastUpdated = (await chrome.storage.local.get([key]))[key];
  return isCacheStale(lastUpdated);
}

async function bustLinksCache() {
  const linksKey = KEY_BASE + "-links";
  const linksTsKey = KEY_BASE + "-updated";
  await chrome.storage.local.remove([linksKey, linksTsKey]);
}

async function bustObjectsCache() {
  const objectsKey = KEY_BASE + "-objects";
  const objectsTsKey = KEY_BASE + "-objects-updated";
  await chrome.storage.local.remove([objectsKey, objectsTsKey]);
}

async function readPinnedList(key) {
  const storedValue = (await chrome.storage.local.get([key]))[key];
  if (!storedValue) return [];
  try {
    const parsed = JSON.parse(storedValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error(`Error parsing pinned list from storage key ${key}`, e);
    return [];
  }
}

async function getPinnedLinks() {
  if (!_pinnedLinks.length) {
    _pinnedLinks = await readPinnedList(KEY_BASE + "-pinned-links");
  }
  return _pinnedLinks;
}

async function getPinnedObjects() {
  if (!_pinnedObjects.length) {
    _pinnedObjects = await readPinnedList(KEY_BASE + "-pinned-objects");
  }
  return _pinnedObjects;
}

async function toggleObjectPin(href) {
  const key = KEY_BASE + "-pinned-objects";
  const pinnedObjects = await getPinnedObjects();
  if (pinnedObjects.includes(href)) {
    _pinnedObjects = pinnedObjects.filter((link) => link !== href);
  } else {
    _pinnedObjects.push(href);
  }
  await chrome.storage.local.set({
    [key]: JSON.stringify(_pinnedObjects),
  });
  const modal = document.getElementById(MODAL_ID);
  if (modal) {
    const searchInput = modal.querySelector(".sf-modal-search-input");
    const objectsCache = await retrieveOrCreateObjectsCache();
    const objectsTabContent = modal.querySelector('.sf-tab-content[data-tab="objects"]');
    renderObjectsCloud(objectsTabContent, objectsCache, searchInput.value);
  }
}

async function togglePin(href) {
  const key = KEY_BASE + "-pinned-links";
  const pinnedLinks = await getPinnedLinks();
  if (pinnedLinks.includes(href)) {
    _pinnedLinks = pinnedLinks.filter((link) => link !== href);
  } else {
    _pinnedLinks.push(href);
  }
  await chrome.storage.local.set({
    [key]: JSON.stringify(_pinnedLinks),
  });
  const modal = document.getElementById(MODAL_ID);
  if (modal) {
    const searchInput = modal.querySelector(".sf-modal-search-input");
    const linksCache = await retrieveOrCreateLinksCache();
    const setupTabContent = modal.querySelector('.sf-tab-content[data-tab="setup"]');
    renderTagCloud(setupTabContent, linksCache, searchInput.value);
  }
}

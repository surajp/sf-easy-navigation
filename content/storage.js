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
  _recentUsers = recentUsers;
  await chrome.storage.local.set({
    [key]: JSON.stringify(_recentUsers),
  });
}

async function retrieveOrCreateUsersCache() {
  const key = KEY_BASE + "-users";
  let usersCache = (await chrome.storage.local.get([key]))[key];
  try {
    usersCache = usersCache ? JSON.parse(usersCache) : { records: [] };
  } catch (e) {
    console.error("Error parsing users cache from localStorage", e);
    usersCache = { records: [] };
  }
  return usersCache;
}

async function saveUsersCache(usersCache, allDone = false) {
  const usersKey = KEY_BASE + "-users";
  const tsKey = KEY_BASE + "-users-updated";
  await chrome.storage.local.set({
    [usersKey]: JSON.stringify(usersCache),
  });
  if (allDone) {
    await chrome.storage.local.set({
      [tsKey]: Date.now().toString(),
    });
  }
}

async function shouldRefreshUsersCache() {
  const key = KEY_BASE + "-users-updated";
  const usersCache = await retrieveOrCreateUsersCache();
  if (!usersCache.records || usersCache.records.length === 0) {
    return true;
  }
  const lastUpdated = (await chrome.storage.local.get([key]))[key];
  if (!lastUpdated) return true;
  const now = Date.now();
  const maxAge = USER_CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return now - parseInt(lastUpdated) > maxAge;
}

async function refreshUsersCache() {
  try {
    const users = await searchUsers("");
    const usersCache = {
      records: users.records.map((user) => ({
        Id: user.Id,
        Name: user.Name,
        Email: user.Email,
        Username: user.Username,
        LastLoginDate: user.LastLoginDate,
        IsActive: user.IsActive,
      })),
    };
    await saveUsersCache(usersCache, true);
    return usersCache;
  } catch (error) {
    console.error("Error refreshing users cache:", error);
    throw error;
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

function bustCaches() {
  const linksKey = KEY_BASE + "-links";
  const objectsKey = KEY_BASE + "-objects";
  const usersKey = KEY_BASE + "-users";
  const linksTsKey = KEY_BASE + "-updated";
  const objectsTsKey = KEY_BASE + "-objects-updated";
  const usersTsKey = KEY_BASE + "-users-updated";
  chrome.storage.local.remove([linksKey, linksTsKey, objectsKey, objectsTsKey, usersKey, usersTsKey]);
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

async function getPinnedLinks() {
  const key = KEY_BASE + "-pinned-links";
  if (!_pinnedLinks.length) {
    const pinnedLinks = (await chrome.storage.local.get([key]))[key];
    _pinnedLinks = pinnedLinks ? JSON.parse(pinnedLinks) : [];
  }
  return _pinnedLinks;
}

async function getPinnedObjects() {
  const key = KEY_BASE + "-pinned-objects";
  if (!_pinnedObjects.length) {
    const pinnedObjects = (await chrome.storage.local.get([key]))[key];
    _pinnedObjects = pinnedObjects ? JSON.parse(pinnedObjects) : [];
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

async function isPinned(href) {
  const pinnedLinks = await getPinnedLinks();
  return pinnedLinks.includes(href);
}

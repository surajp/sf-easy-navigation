/********* content.js **************/
console.log("Salesforce Go Home/Setup Extension: Content script loaded.");

const BUTTON_ID = "sf-go-home-setup-button-ext";
const MODAL_ID = "sf-setup-tag-cloud-modal-ext";
const SETUP_PATH_REGEX = /\/lightning\/setup/;
const HOME_PATH = "/lightning/page/home";
const SETUP_HOME_PATH = "/lightning/setup/SetupOneHome/home";
const OBJECT_MANAGER_PATH = "/lightning/setup/ObjectManager/home";
const KEY_BASE = `sf-setup-links-${getDomain()}`;
const SALESFORCE_API_VERSION = "60.0";
const BUTTON_CLICK_DELAY_MS = 300;

// --- Caches and State ---
let sessionIdCache = null;
let orgIdCache = null;
let currentButton;
let clickCount = 0;
let clickTimer;
let isExtracting = false; // Flag to prevent multiple extractions at once
let _pinnedLinks = []; // Placeholder for pinned links
let _pinnedObjects = []; // Placeholder for pinned objects

// --- Helper Function for Delay ---
function delay(ms) {
  return new Promise((resolve) => {
    const start = performance.now();
    function check(timestamp) {
      if (timestamp - start >= ms) {
        resolve();
      } else {
        requestAnimationFrame(check);
      }
    }
    requestAnimationFrame(check);
  });
}

function createButton() {
  // ... (keep your createButton function)
  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.classList.add("sf-go-home-setup-button");
  return button;
}

function updateButtonState() {
  // ... (keep most of your updateButtonState function)
  const isOnSetup = SETUP_PATH_REGEX.test(window.location.pathname);
  if (!currentButton) {
    currentButton = document.getElementById(BUTTON_ID);
    if (!currentButton) {
      currentButton = createButton();
      document.body.appendChild(currentButton);
      console.log("Salesforce Go Home/Setup Extension: Button added.");
      currentButton.addEventListener("click", handleButtonClick);
    }
  }

  if (currentButton) {
    // Disable button during extraction
    currentButton.disabled = isExtracting;
    if (isOnSetup) {
      currentButton.textContent = isExtracting
        ? "⚙️ Extracting..."
        : "🏠 Go Home";
    } else {
      currentButton.textContent = "⚙️ Go To Setup";
    }
  }
}
async function openModal() {
  clickCount = 0;
  if (isExtracting) {
    console.log("Extraction already in progress.");
    return;
  }

  // Check if we're on setup or object manager
  const isOnSetup = SETUP_PATH_REGEX.test(window.location.pathname);
  const isOnObjectManager = window.location.pathname.includes(
    "/lightning/setup/ObjectManager",
  );

  if (isOnSetup) {
    updateButtonState(); // Update button text/state
    displaySetupTagCloud();

    if (isOnObjectManager) {
      // Handle object manager extraction
      let objectsCache = await retrieveOrCreateObjectsCache();
      if (await shouldRefreshObjectsCache()) {
        isExtracting = true;
        objectsCache = await extractObjectManagerObjects();
        isExtracting = false;
      }
    } else {
      // Handle setup links extraction
      let linksCache = await retrieveOrCreateLinksCache();
      if (await shouldRefreshCache()) {
        isExtracting = true;
        // Send message to background, which will immediately reply to start async process
        chrome.runtime.sendMessage({
          action: "requestSetupLinkExtraction",
          data: JSON.stringify(linksCache), // Send current cache
        });
      }
    }
  } else {
    let linksCache = await retrieveOrCreateLinksCache();
    if (Object.keys(linksCache).length === 0) {
      console.log("No links found, extraction might be needed.");
      return;
    }
  }
  updateButtonState();
  displaySetupTagCloud();
}

function handleButtonClick(event) {
  // ... (keep your handleButtonClick logic, but maybe disable during extraction)
  event.preventDefault();
  if (isExtracting) return; // Don't navigate while extracting

  const isCtrlPressed = event.ctrlKey || event.metaKey; // Check for Ctrl or Cmd key
  clickCount++;
  if (clickCount === 1) {
    if (isCtrlPressed) {
      navigateToHome(isCtrlPressed);
      return;
    }
    clickTimer = setTimeout(() => navigateToHome(isCtrlPressed), BUTTON_CLICK_DELAY_MS); // Time window for multiple clicks
  } else if (clickCount === 2) {
    clearTimeout(clickTimer);
    clickTimer = setTimeout(openModal, BUTTON_CLICK_DELAY_MS);
  } else if (clickCount === 3) {
    clearTimeout(clickTimer);
    bustCaches();
    openModal();
  }
}

function navigateToHome(isCtrlPressed) {
  clickCount = 0;
  const isOnSetup = SETUP_PATH_REGEX.test(window.location.pathname);
  const urlToNavigate = `${window.location.origin}${isOnSetup ? HOME_PATH : SETUP_HOME_PATH}`;
  if (isCtrlPressed) {
    window.open(urlToNavigate, "_blank");
  } else {
    window.location.href = urlToNavigate;
  }
}

function getDomain() {
  const url = new URL(window.location.href);
  return url.hostname.split(".")[0];
}

function getSalesforceApiOrigin() {
  const origin = window.location.origin;
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    if (hostname.includes(".lightning.force.com")) {
      const instanceName = hostname.split(".")[0];
      const salesforceDomain = instanceName.includes("--")
        ? `${instanceName}.sandbox.my.salesforce.com`
        : `${instanceName}.my.salesforce.com`;
      return `https://${salesforceDomain}`;
    }
  } catch (error) {
    console.warn("getSalesforceApiOrigin: failed to parse origin", error);
  }
  return origin;
}

async function getSessionId() {
  if (sessionIdCache) {
    return sessionIdCache;
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: "getSessionCookie",
        url: window.location.href,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response?.error) {
          reject(new Error(response.error));
          return;
        }
        if (!response?.sessionId) {
          reject(new Error("No Salesforce session detected."));
          return;
        }
        sessionIdCache = response.sessionId;
        resolve(sessionIdCache);
      },
    );
  });
}

async function executeSoqlQuery(soqlQuery) {
  const sessionId = await getSessionId();
  if (!sessionId) {
    throw new Error("No session found. Please ensure you're logged into Salesforce.");
  }

  const apiUrl = `${getSalesforceApiOrigin()}/services/data/v${SALESFORCE_API_VERSION}/query?q=${encodeURIComponent(soqlQuery)}`;

  const response = await fetch(apiUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${sessionId}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Session expired. Please refresh the page.");
    }
    if (response.status === 403) {
      throw new Error("Permission denied. Ensure you have 'Manage Users' permissions.");
    }
    throw new Error(`API Error ${response.status}`);
  }

  return response.json();
}

async function getOrgId() {
  if (orgIdCache) {
    return orgIdCache;
  }

  try {
    const result = await executeSoqlQuery("SELECT Id FROM Organization LIMIT 1");
    orgIdCache = result.records && result.records.length ? result.records[0].Id : null;
    return orgIdCache;
  } catch (error) {
    console.error("Error fetching org ID:", error);
    throw error;
  }
}

async function searchUsers(searchTerm = "") {
  const fields = "Id, Name, Email, Username, LastLoginDate, IsActive";
  const sanitizedTerm = searchTerm.trim().replace(/'/g, "\\'");
  let query = `SELECT ${fields} FROM User WHERE IsActive = true`;

  if (sanitizedTerm) {
    const likeTerm = `%${sanitizedTerm}%`;
    query += ` AND (Name LIKE '${likeTerm}' OR Email LIKE '${likeTerm}' OR Username LIKE '${likeTerm}')`;
    query += " ORDER BY Name ASC LIMIT 50";
  } else {
    query += " ORDER BY LastLoginDate DESC NULLS LAST LIMIT 50";
  }

  try {
    return await executeSoqlQuery(query);
  } catch (error) {
    console.error("Error searching users:", error);
    throw error;
  }
}

async function getLoginAsUrl(targetUserId) {
  if (!targetUserId) {
    throw new Error("Missing user identifier.");
  }

  const orgId = await getOrgId();
  if (!orgId) {
    throw new Error("Unable to determine org ID.");
  }

  const currentPath = window.location.pathname + window.location.search + window.location.hash;
  const encodedPath = encodeURIComponent(currentPath || "/");
  const baseUrl = getSalesforceApiOrigin();

  return `${baseUrl}/servlet/servlet.su?oid=${orgId}&suorgadminid=${targetUserId}&retURL=${encodedPath}&targetURL=${encodedPath}`;
}

function showLoadingIndicator(containerElement) {
  if (!containerElement) return;
  containerElement.innerHTML = "";
  const loadingWrapper = document.createElement("div");
  loadingWrapper.classList.add("sf-loading-spinner");
  loadingWrapper.innerHTML = '<div class="sf-spinner"></div><p>Searching users...</p>';
  containerElement.appendChild(loadingWrapper);
}

async function fetchAndRenderLoginAsUsers(searchTerm, containerElement, tabContent) {
  if (!containerElement) return;
  showLoadingIndicator(containerElement);
  try {
    const users = await searchUsers(searchTerm);
    renderUserResults(containerElement, users, searchTerm);
    if (!searchTerm && tabContent) {
      tabContent.dataset.loaded = "true";
    }
  } catch (error) {
    containerElement.innerHTML = "";
    const errorDiv = document.createElement("p");
    errorDiv.classList.add("sf-error-message");
    errorDiv.textContent = error.message;
    containerElement.appendChild(errorDiv);
  }
}

function renderUserResults(containerElement, users, searchTerm = "") {
  containerElement.innerHTML = "";
  const usersContainer = document.createElement("div");
  usersContainer.classList.add("sf-users-container");
  containerElement.appendChild(usersContainer);

  if (!users.records || users.records.length === 0) {
    const noResults = document.createElement("p");
    noResults.classList.add("sf-empty-message");
    noResults.textContent = searchTerm ? "No matching users found." : "No users found.";
    usersContainer.appendChild(noResults);
    return;
  }

  users.records.forEach((user) => {
    const userRow = document.createElement("div");
    userRow.classList.add("sf-user-item");
    userRow.setAttribute("role", "button");
    userRow.tabIndex = 0;

    const userContent = document.createElement("div");
    userContent.classList.add("sf-user-content");

    const userName = document.createElement("div");
    userName.classList.add("sf-user-name");
    userName.textContent = user.Name;

    const userDetails = document.createElement("div");
    userDetails.classList.add("sf-user-details");
    userDetails.textContent = `${user.Username} - ${user.Email}`;

    userContent.appendChild(userName);
    userContent.appendChild(userDetails);
    userRow.appendChild(userContent);

    const handleLoginAs = async () => {
      try {
        const loginAsUrl = await getLoginAsUrl(user.Id);
        window.location.href = loginAsUrl;
        const modal = document.getElementById(MODAL_ID);
        if (modal) modal.remove();
      } catch (error) {
        console.error("Error logging in as user:", error);
        alert("Failed to login as user: " + error.message);
      }
    };

    userRow.addEventListener("click", handleLoginAs);
    userRow.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleLoginAs();
      }
    });

    usersContainer.appendChild(userRow);
  });
}

async function retrieveOrCreateLinksCache() {
  const key = KEY_BASE + "-links";
  let linksCache = (await chrome.storage.local.get([key]))[key];
  debugger;
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

async function saveLinksCache(linksCache, allDone = false) {
  const linkskey = KEY_BASE + "-links";
  const tsKey = KEY_BASE + "-updated";
  await chrome.storage.local.set({
    [linkskey]: JSON.stringify(linksCache),
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

async function shouldRefreshObjectsCache() {
  const key = KEY_BASE + "-objects-updated";
  const objectsCache = await retrieveOrCreateObjectsCache();
  if (Object.keys(objectsCache).length === 0) {
    return true; // No cache, refresh
  }
  // Check if the cache is older than 1 hour
  const lastUpdated = (await chrome.storage.local.get([key]))[key];
  if (lastUpdated) {
    const now = Date.now();
    const sixtyDays = 60 * 24 * 60 * 60 * 1000;
    return now - lastUpdated > sixtyDays;
  }
  return true; // If no timestamp, refresh
}

async function shouldRefreshCache() {
  const key = KEY_BASE + "-updated";
  const linksCache = await retrieveOrCreateLinksCache();
  if (Object.keys(linksCache).length === 0) {
    return true; // No cache, refresh
  }
  // Check if the cache is older than 1 hour
  const lastUpdated = (await chrome.storage.local.get([key]))[key];
  if (lastUpdated) {
    const now = Date.now();
    const sixtyDays = 60 * 24 * 60 * 60 * 1000;
    return now - lastUpdated > sixtyDays;
  }
  return true; // If no timestamp, refresh
}

function bustCaches() {
  const linksKey = KEY_BASE + "-links";
  const objectsKey = KEY_BASE + "-objects";
  const linksTsKey = KEY_BASE + "-updated";
  const objectsTsKey = KEY_BASE + "-objects-updated";
  chrome.storage.local.remove([linksKey, linksTsKey, objectsKey, objectsTsKey]);
}

async function displaySetupTagCloud(searchTerm = "", isLoading = false) {
  let existingModal = document.getElementById(MODAL_ID);
  if (existingModal && !isLoading) {
    // Don't remove if just updating loading state
    existingModal.remove();
    existingModal = null; // Reset to allow re-creation
  }

  let modal = existingModal;
  if (!modal) {
    modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.classList.add("sf-setup-tag-cloud-modal");

    const title = document.createElement("h2");
    title.textContent = "Salesforce Navigation";
    modal.appendChild(title);

    // Create tab container
    // Create tab container
    const tabContainer = document.createElement("div");
    tabContainer.classList.add("sf-tab-container");
    modal.appendChild(tabContainer);

    // Create top row container for tabs and record ID navigation
    const topRowContainer = document.createElement("div");
    topRowContainer.classList.add("sf-top-row-container");
    modal.appendChild(topRowContainer);

    // Create tab buttons container (left side)
    const tabButtonsContainer = document.createElement("div");
    tabButtonsContainer.classList.add("sf-tab-buttons-container");
    topRowContainer.appendChild(tabButtonsContainer);

    // Create tab buttons
    const setupTabBtn = document.createElement("button");
    setupTabBtn.textContent = "Setup Links";
    setupTabBtn.classList.add("sf-tab-button", "sf-tab-active");
    setupTabBtn.dataset.tab = "setup";

    const objectsTabBtn = document.createElement("button");
    objectsTabBtn.textContent = "Object Manager";
    objectsTabBtn.classList.add("sf-tab-button");
    objectsTabBtn.dataset.tab = "objects";

    const loginAsTabBtn = document.createElement("button");
    loginAsTabBtn.textContent = "Login As User";
    loginAsTabBtn.classList.add("sf-tab-button");
    loginAsTabBtn.dataset.tab = "loginas";

    tabButtonsContainer.appendChild(setupTabBtn);
    tabButtonsContainer.appendChild(objectsTabBtn);
    tabButtonsContainer.appendChild(loginAsTabBtn);

    // Setup tab click handlers
    setupTabBtn.addEventListener("click", () => switchTab("setup"));
    objectsTabBtn.addEventListener("click", () => switchTab("objects"));
    loginAsTabBtn.addEventListener("click", () => switchTab("loginas"));

    // Add record ID navigation box (right side)
    const recordNavContainer = document.createElement("div");
    recordNavContainer.classList.add("sf-record-nav-container");
    topRowContainer.appendChild(recordNavContainer);

    const recordIdInput = document.createElement("input");
    recordIdInput.type = "text";
    recordIdInput.placeholder = "Enter record ID...";
    recordIdInput.classList.add("sf-record-id-input");

    const recordNavButton = document.createElement("button");
    recordNavButton.textContent = "Go to Record";
    recordNavButton.classList.add("sf-record-nav-button");
    recordNavButton.addEventListener("click", () =>
      navigateToRecord(recordIdInput.value),
    );

    recordIdInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === "NumpadEnter") {
        if (isValidRecordId(recordIdInput.value)) {
          event.preventDefault();
          navigateToRecord(recordIdInput.value);
        }
      }
    });

    recordNavContainer.appendChild(recordIdInput);
    recordNavContainer.appendChild(recordNavButton);

    // Create tab content containers
    const setupTabContent = document.createElement("div");
    setupTabContent.classList.add("sf-tab-content", "sf-tab-active");
    setupTabContent.dataset.tab = "setup";

    const objectsTabContent = document.createElement("div");
    objectsTabContent.classList.add("sf-tab-content");
    objectsTabContent.dataset.tab = "objects";

    const loginAsTabContent = document.createElement("div");
    loginAsTabContent.classList.add("sf-tab-content");
    loginAsTabContent.dataset.tab = "loginas";

    const loginAsResultsContainer = document.createElement("div");
    loginAsResultsContainer.classList.add("sf-users-container-wrapper");
    loginAsTabContent.appendChild(loginAsResultsContainer);

    // Create search input (shared across all tabs)
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Filter links or search users...";
    searchInput.classList.add("sf-modal-search-input");
    searchInput.addEventListener("input", async (event) => {
      const activeTabButton = document.querySelector(".sf-tab-button.sf-tab-active");
      const currentTab = activeTabButton ? activeTabButton.dataset.tab : "setup";
      const searchTerm = event.target.value.trim();
      if (currentTab === "setup") {
        const currentCache = await retrieveOrCreateLinksCache();
        renderTagCloud(setupTabContent, currentCache, searchTerm);
      } else if (currentTab === "objects") {
        const objectsCache = await retrieveOrCreateObjectsCache();
        renderObjectsCloud(objectsTabContent, objectsCache, searchTerm);
      } else if (currentTab === "loginas") {
        fetchAndRenderLoginAsUsers(searchTerm, loginAsResultsContainer, loginAsTabContent);
      }
    });
    modal.appendChild(searchInput);
    // Add the tab content containers to the modal
    modal.appendChild(setupTabContent);
    modal.appendChild(objectsTabContent);
    modal.appendChild(loginAsTabContent);

    // Create loading indicator
    const loadingIndicator = document.createElement("p");
    loadingIndicator.classList.add("sf-loading-indicator");
    loadingIndicator.style.display = "none"; // Hide initially
    loadingIndicator.textContent = "Extracting more links...";
    modal.appendChild(loadingIndicator);

    // Create close button
    const closeButton = document.createElement("button");
    closeButton.textContent = "Close";
    closeButton.classList.add("sf-modal-close-button");
    closeButton.addEventListener("click", () => {
      modal.remove();
    });
    modal.appendChild(closeButton);

    document.body.appendChild(modal);
    console.log("modal appended");
    searchInput.focus(); // Focus on the search input
  }

  // Update loading indicator visibility
  const loadingIndicator = modal.querySelector(".sf-loading-indicator");
  if (loadingIndicator) {
    loadingIndicator.style.display = isLoading ? "block" : "none";
  }

  const linksCache = await retrieveOrCreateLinksCache();
  const setupTabContent = modal.querySelector(
    '.sf-tab-content[data-tab="setup"]',
  );
  renderTagCloud(setupTabContent, linksCache, searchTerm); // Render with current cache

  // Initialize objects tab
  const objectsCache = await retrieveOrCreateObjectsCache();
  const objectsTabContent = modal.querySelector(
    '.sf-tab-content[data-tab="objects"]',
  );
  renderObjectsCloud(objectsTabContent, objectsCache, searchTerm);
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
    const objectsTabContent = modal.querySelector(
      '.sf-tab-content[data-tab="objects"]',
    );
    renderObjectsCloud(objectsTabContent, objectsCache, searchInput.value);
  }
}

function isValidRecordId(recordId) {
  if (!recordId) return false;

  const cleanedId = recordId.trim();
  const isFifteenChars = /^[a-zA-Z0-9]{15}$/.test(cleanedId);
  const isEighteenChars = /^[a-zA-Z0-9]{18}$/.test(cleanedId);
  return isFifteenChars || isEighteenChars;
}

function navigateToRecord(recordId) {
  if (!recordId) return;

  // Clean up the record ID (remove spaces, etc.)
  recordId = recordId.trim();

  // Navigate to the record
  const recordUrl = `${window.location.origin}/${recordId}`;
  window.location.href = recordUrl;
}

function switchTab(tabName) {
  // Update active tab button
  const tabButtons = document.querySelectorAll(".sf-tab-button");
  tabButtons.forEach((btn) => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add("sf-tab-active");
    } else {
      btn.classList.remove("sf-tab-active");
    }
  });

  // Update active tab content
  const tabContents = document.querySelectorAll(".sf-tab-content");
  tabContents.forEach((content) => {
    if (content.dataset.tab === tabName) {
      content.classList.add("sf-tab-active");
    } else {
      content.classList.remove("sf-tab-active");
    }
  });

  if (tabName === "loginas") {
    const loginAsTabContent = document.querySelector(
      '.sf-tab-content[data-tab="loginas"]',
    );
    const resultsContainer = loginAsTabContent
      ? loginAsTabContent.querySelector(".sf-users-container-wrapper")
      : null;
    const searchInput = document.querySelector(".sf-modal-search-input");
    if (searchInput) searchInput.focus();
    if (
      loginAsTabContent &&
      resultsContainer &&
      loginAsTabContent.dataset.loaded !== "true"
    ) {
      fetchAndRenderLoginAsUsers(
        searchInput ? searchInput.value.trim() : "",
        resultsContainer,
        loginAsTabContent,
      );
    }
    return;
  }

  // Focus the search input after switching tabs
  const searchInput = document.querySelector(".sf-modal-search-input");
  if (searchInput) searchInput.focus();
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
    const setupTabContent = modal.querySelector(
      '.sf-tab-content[data-tab="setup"]',
    );
    renderTagCloud(setupTabContent, linksCache, searchInput.value);
  }
}

async function isPinned(href) {
  const pinnedLinks = await getPinnedLinks();
  return pinnedLinks.includes(href);
}
async function renderTagCloud(containerElement, links, searchTerm = "") {
  containerElement.innerHTML = ""; // Clear previous content

  const tagCloudContainer = document.createElement("div");
  tagCloudContainer.classList.add("sf-tag-cloud-container");
  containerElement.appendChild(tagCloudContainer);

  await getPinnedLinks(); // Ensure pinned links are loaded
  const sortedLinks = Object.entries(links)
    .sort(([, valA], [, valB]) => valA.href.localeCompare(valB.href)) // Sort by URL for consistency
    .sort(([, valA], [, valB]) => valA.label.localeCompare(valB.label)) // Sort by label
    .sort(([, valA], [, valB]) => {
      return (
        _pinnedLinks.includes(valB.href) - _pinnedLinks.includes(valA.href)
      );
    });

  for (const [, value] of sortedLinks) {
    if (
      !searchTerm ||
      value.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      value.parentLabel?.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      const div = document.createElement("div");
      div.classList.add("sf-tag-cloud-item");
      div.classList.add((await isPinned(value.href)) ? "pinned" : "unpinned");
      const link = document.createElement("a");
      link.href = value.href;
      link.textContent = value.label;
      link.title = value.parentLabel || ""; // Show parent label if available
      link.classList.add("sf-tag-cloud-tag");
      // Use onclick for simplicity here, but addEventListener is generally better
      link.onclick = (e) => {
        e.preventDefault(); // Prevent default navigation
        window.location.href = link.href; // Navigate manually
        const modal = document.getElementById(MODAL_ID);
        if (modal) modal.remove(); // Close modal on click
        return false;
      };
      div.appendChild(link);
      const pinBtn = document.createElement("button");
      pinBtn.textContent = (await isPinned(value.href)) ? "📍" : "📌";
      pinBtn.classList.add("sf-tag-cloud-pin-button");
      pinBtn.onclick = () => {
        togglePin(value.href);
      };
      div.appendChild(pinBtn);
      const parentLabel = document.createElement("span");
      parentLabel.textContent = value.parentLabel;
      parentLabel.classList.add("sf-tag-cloud-parent-label");
      div.appendChild(parentLabel);
      tagCloudContainer.appendChild(div);
    }
  }

  if (tagCloudContainer.children.length === 0 && searchTerm) {
    const noResults = document.createElement("p");
    noResults.textContent = "No matching links found.";
    tagCloudContainer.appendChild(noResults);
  } else if (Object.keys(links).length === 0 && !searchTerm) {
    const noResults = document.createElement("p");
    noResults.textContent =
      "No links found yet. Extraction might be needed (triple-click button).";
    tagCloudContainer.appendChild(noResults);
  }
}

async function renderObjectsCloud(containerElement, objects, searchTerm = "") {
  containerElement.innerHTML = ""; // Clear previous content
  let setupTab = document.querySelector(`.sf-tab-button[data-tab="setup"]`);
  if (setupTab) {
    // setupTab.style.display = "none"; // Hide setup tab
  }
  const objectsContainer = document.createElement("div");
  objectsContainer.classList.add("sf-objects-container");
  containerElement.appendChild(objectsContainer);

  // Get pinned objects
  await getPinnedObjects();

  if (Object.keys(objects).length === 0) {
    const extractMessage = document.createElement("div");
    extractMessage.classList.add("sf-empty-message");
    extractMessage.textContent =
      "No objects found. Navigate to Object Manager and double-click the button to extract objects.";
    objectsContainer.appendChild(extractMessage);
    return;
  }

  const sortedObjects = Object.entries(objects)
    .sort(([, valA], [, valB]) => valA.label.localeCompare(valB.label)) // Sort alphabetically
    .sort(([, valA], [, valB]) => {
      return (
        _pinnedObjects.includes(valB.href) - _pinnedObjects.includes(valA.href)
      );
    });

  for (const [key, value] of sortedObjects) {
    if (
      !searchTerm ||
      value.label.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      const div = document.createElement("div");
      div.classList.add("sf-object-item");
      div.classList.add(
        _pinnedObjects.includes(value.href) ? "pinned" : "unpinned",
      );

      const link = document.createElement("a");
      link.href = value.href;
      link.textContent = value.label;
      link.classList.add("sf-object-link");
      link.onclick = (e) => {
        e.preventDefault();
        window.location.href = link.href;
        const modal = document.getElementById(MODAL_ID);
        if (modal) modal.remove();
        return false;
      };

      div.appendChild(link);

      const pinBtn = document.createElement("button");
      pinBtn.textContent = _pinnedObjects.includes(value.href) ? "📍" : "📌";
      pinBtn.classList.add("sf-object-pin-button");
      pinBtn.onclick = () => toggleObjectPin(value.href);

      div.appendChild(pinBtn);
      objectsContainer.appendChild(div);
    }
  }

  if (objectsContainer.children.length === 0 && searchTerm) {
    const noResults = document.createElement("p");
    noResults.textContent = "No matching objects found.";
    objectsContainer.appendChild(noResults);
  }
}

async function extractObjectManagerObjects() {
  console.log("Starting object extraction from Object Manager...");

  if (!window.location.pathname.includes("/lightning/setup/ObjectManager")) {
    console.warn("Not on Object Manager page, can't extract objects");
    return {};
  }

  let objectsCache = await retrieveOrCreateObjectsCache();
  isExtracting = true;
  updateButtonState();

  try {
    // Find object links in the Object Manager table
    const parentNode = document.querySelector("div.objectManagerObjectList");
    const objectTable = parentNode.querySelector("table.slds-table");
    if (!objectTable) {
      console.warn("Object Manager table not found");
      return objectsCache;
    }
    console.log("scrolling now...");
    // keep scrolling till we get to the bottom of the page
    let lastScrollTop = -1;
    let scroller = parentNode.querySelector("div.scroller");
    while (true) {
      const scrollTop = scroller.scrollTop || 0;
      if (scrollTop === lastScrollTop) {
        break; // No more scrolling
      }
      lastScrollTop = scrollTop;
      scroller.scrollBy(0, window.innerHeight);
      await delay(1000); // Wait for the scroll to settle
    }

    // Extract objects from the table
    const objectRows = objectTable.querySelectorAll("tbody tr");
    objectRows.forEach((row) => {
      const linkElement = row.querySelector("th a");
      if (!linkElement) return;

      const label = linkElement.textContent.trim();
      const href = linkElement.href;

      if (label && href) {
        const key = label;
        objectsCache[key] = {
          label,
          href,
        };
      }
    });

    await saveObjectsCache(objectsCache, true);
    console.log(
      `Extracted ${Object.keys(objectsCache).length} objects from Object Manager`,
    );

    return objectsCache;
  } catch (error) {
    console.error("Error extracting objects from Object Manager:", error);
    return objectsCache;
  } finally {
    isExtracting = false;
    updateButtonState();
  }
}

// --- NEW Asynchronous Link Extraction Logic ---
async function performAsyncTaskExtraction(initialLinksCache) {
  console.log("Starting asynchronous link extraction...");
  let linksCache = { ...initialLinksCache }; // Work on a copy
  const clickedButtons = new Set(); // Keep track of buttons we've already clicked

  // Update modal to show loading state
  displaySetupTagCloud("", true);

  try {
    let buttonsToClick = findClickableSetupButtons(clickedButtons);

    while (buttonsToClick.length > 0) {
      console.log(`Found ${buttonsToClick.length} buttons to click.`);
      for (const button of buttonsToClick) {
        if (clickedButtons.has(button)) continue; // Skip if already processed somehow

        console.log(
          "Clicking button:",
          button.textContent || button.ariaLabel || button,
        );
        button.click();
        clickedButtons.add(button); // Mark as clicked

        // --- CRITICAL: Wait for the DOM to potentially update ---
        await delay(200); // Adjust delay as needed (start with 200-500ms)

        // Re-query for links after the click and delay
        extractVisibleLinks(linksCache);
      }

      // After processing a batch, find the next set of buttons
      buttonsToClick = findClickableSetupButtons(clickedButtons);

      // Optional: Update modal/cache periodically during long extractions
      await saveLinksCache(linksCache, false);
      displaySetupTagCloud(
        document.querySelector(`#${MODAL_ID} .sf-modal-search-input`)?.value ||
          "",
        true,
      ); // Update display, keep loading
    }
  } catch (error) {
    console.error("Error during asynchronous extraction:", error);
  } finally {
    // Final extraction pass after all clicks
    extractVisibleLinks(linksCache);
    await saveLinksCache(linksCache, true);
    isExtracting = false;
    updateButtonState(); // Re-enable button
    displaySetupTagCloud(
      document.querySelector(`#${MODAL_ID} .sf-modal-search-input`)?.value ||
        "",
      false,
    ); // Update display, hide loading
  }
}

function findClickableSetupButtons(alreadyClicked) {
  // Find buttons that expand tree nodes. Adjust the selector based on Salesforce's actual structure.
  // Common patterns involve buttons within slds-tree__item, often with specific aria-labels or icons.
  const parentNodes = document.body.querySelectorAll(
    "li[data-placement='parent']",
  );
  const potentialButtons = [];
  for (const node of parentNodes) {
    const button = node.querySelector("button.slds-button[title='Expand']");
    if (button && isElementVisible(button) && !alreadyClicked.has(button)) {
      // Check if the button is visible and not already clicked
      potentialButtons.push(button);
    }
  }
  return potentialButtons;
}

function extractVisibleLinks(linksCache) {
  // Extracts currently visible links (<a> tags with href)
  // Adjust selector '.slds-tree__item-label' if needed
  document.body
    .querySelectorAll("li[data-placement='leaf']")
    .forEach((leafNode) => {
      const link = leafNode.querySelector("a.slds-tree__item-label");
      if (!link) return; // Skip if no link found
      const label = link.textContent?.trim();
      const href = link.href;
      // Ensure it's a valid, non-javascript link and has text
      if (
        label &&
        href &&
        !href.startsWith("javascript:") &&
        !href.startsWith("#")
      ) {
        let parentLabel = [];
        let parentNode = leafNode.closest("li[data-placement='parent']");
        while (parentNode) {
          parentLabel.unshift(
            parentNode
              .querySelector("a.slds-tree__item-label")
              .textContent.trim(),
          );
          parentNode = parentNode.parentElement?.closest(
            "li[data-placement='parent']",
          );
        }
        let parentLabelText = parentLabel.join(" > ");
        const fullKey = `${parentLabelText} > ${label}`;
        linksCache[fullKey] = linksCache[fullKey] || {}; // Initialize if not present
        linksCache[fullKey].href = href; // Add or update
        linksCache[fullKey].parentLabel = parentLabelText; // Store parent label
        linksCache[fullKey].label = label; // Store label
      }
    });
}

// Helper to check if an element is visible (basic check)
function isElementVisible(el) {
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

// --- Initial Setup ---
updateButtonState();
setInterval(updateButtonState, 1000); // Keep checking state

// Observer might still be useful for initial load or major DOM changes
const bodyObserver = new MutationObserver((mutationsList, observer) => {
  if (!document.getElementById(BUTTON_ID) && !isExtracting) {
    console.log(
      "Salesforce Go Home/Setup Extension: Body changed, ensuring button exists.",
    );
    updateButtonState();
  }
  // Could potentially add logic here to re-check for links if the observer sees relevant changes
});
bodyObserver.observe(document.body, { childList: true, subtree: true }); // Observe subtree for dynamic loading

// --- Message Listener ---
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  console.log("received message in content script:", request.action);
  if (request.action === "beginAsyncLinkExtraction") {
    // Background script told us to start
    const initialCache = JSON.parse(request.data || "{}");
    performAsyncTaskExtraction(initialCache); // Start the local async process
  } else if (request.action === "setupLinksExtracted") {
    // This message might now be redundant if extraction happens entirely in content.js
    // Or you could use it if the background *does* still do some processing (like fetching)
    console.warn(
      "Received setupLinksExtracted message, may be handled differently now.",
    );
    const linksCache = JSON.parse(request.data);
    await saveLinksCache(linksCache);
    displaySetupTagCloud("", isExtracting); // Update display
  }
});
/*************** end of content.js *******************/

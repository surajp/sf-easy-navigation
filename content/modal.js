/********* content/modal.js **************/
function modalIsCurrentlyOpen() {
  return Boolean(document.getElementById(MODAL_ID));
}

function cleanupModal(modal) {
  if (tabHoverTimer) {
    clearTimeout(tabHoverTimer);
    tabHoverTimer = null;
  }
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
  }
  if (modal && modal.parentNode) {
    modal.remove();
  }
}

async function displaySetupTagCloud(searchTerm = "", isLoading = false) {
  let existingModal = document.getElementById(MODAL_ID);
  if (existingModal && !isLoading) {
    cleanupModal(existingModal);
    existingModal = null;
  }
  let modal = existingModal;
  if (!modal) {
    modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.classList.add("sf-setup-tag-cloud-modal");

    const title = document.createElement("h2");
    title.textContent = "Salesforce Navigation";
    modal.appendChild(title);

    const tabContainer = document.createElement("div");
    tabContainer.classList.add("sf-tab-container");
    modal.appendChild(tabContainer);

    const topRowContainer = document.createElement("div");
    topRowContainer.classList.add("sf-top-row-container");
    modal.appendChild(topRowContainer);

    const tabButtonsContainer = document.createElement("div");
    tabButtonsContainer.classList.add("sf-tab-buttons-container");
    topRowContainer.appendChild(tabButtonsContainer);

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

    setupTabBtn.addEventListener("click", () => switchTab("setup"));
    objectsTabBtn.addEventListener("click", () => switchTab("objects"));
    loginAsTabBtn.addEventListener("click", () => switchTab("loginas"));

    setupTabBtn.addEventListener("mouseenter", () => handleTabHoverStart("setup"));
    setupTabBtn.addEventListener("mouseleave", handleTabHoverEnd);
    objectsTabBtn.addEventListener("mouseenter", () => handleTabHoverStart("objects"));
    objectsTabBtn.addEventListener("mouseleave", handleTabHoverEnd);
    loginAsTabBtn.addEventListener("mouseenter", () => handleTabHoverStart("loginas"));
    loginAsTabBtn.addEventListener("mouseleave", handleTabHoverEnd);

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
    recordNavButton.addEventListener("click", () => navigateToRecord(recordIdInput.value));

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

    const setupTabContent = document.createElement("div");
    setupTabContent.classList.add("sf-tab-content", "sf-tab-active");
    setupTabContent.dataset.tab = "setup";

    const setupRefreshContainer = document.createElement("div");
    setupRefreshContainer.classList.add("sf-tab-refresh-container");
    const setupRefreshBtn = document.createElement("button");
    setupRefreshBtn.textContent = "🔄 Refresh Setup Links";
    setupRefreshBtn.classList.add("sf-tab-refresh-button");
    setupRefreshBtn.addEventListener("click", async () => {
      await bustLinksCache();
      const isOnSetup = SETUP_PATH_REGEX.test(window.location.pathname);
      if (isOnSetup) {
        isExtracting = true;
        updateButtonState();
        let linksCache = await retrieveOrCreateLinksCache();
        chrome.runtime.sendMessage({
          action: "requestSetupLinkExtraction",
          data: JSON.stringify(linksCache),
        });
      } else {
        await openModal();
      }
    });
    setupRefreshContainer.appendChild(setupRefreshBtn);
    setupTabContent.appendChild(setupRefreshContainer);

    const objectsTabContent = document.createElement("div");
    objectsTabContent.classList.add("sf-tab-content");
    objectsTabContent.dataset.tab = "objects";

    const objectsRefreshContainer = document.createElement("div");
    objectsRefreshContainer.classList.add("sf-tab-refresh-container");
    const objectsRefreshBtn = document.createElement("button");
    objectsRefreshBtn.textContent = "🔄 Refresh Objects";
    objectsRefreshBtn.classList.add("sf-tab-refresh-button");
    objectsRefreshBtn.addEventListener("click", async () => {
      await bustObjectsCache();
      const isOnObjectManager = window.location.pathname.includes("/lightning/setup/ObjectManager");
      if (isOnObjectManager) {
        isExtracting = true;
        updateButtonState();
        const objectsCache = await extractObjectManagerObjects();
        isExtracting = false;
        updateButtonState();
        const modalRef = document.getElementById(MODAL_ID);
        if (modalRef) {
          const searchInputRef = modalRef.querySelector(".sf-modal-search-input");
          const objectsTabRef = modalRef.querySelector('.sf-tab-content[data-tab="objects"]');
          renderObjectsCloud(objectsTabRef, objectsCache, searchInputRef.value);
        }
      } else {
        await openModal();
      }
    });
    objectsRefreshContainer.appendChild(objectsRefreshBtn);
    objectsTabContent.appendChild(objectsRefreshContainer);

    const loginAsTabContent = document.createElement("div");
    loginAsTabContent.classList.add("sf-tab-content");
    loginAsTabContent.dataset.tab = "loginas";

    const loginAsRefreshContainer = document.createElement("div");
    loginAsRefreshContainer.classList.add("sf-tab-refresh-container");
    const loginAsRefreshBtn = document.createElement("button");
    loginAsRefreshBtn.textContent = "🔄 Refresh Users";
    loginAsRefreshBtn.classList.add("sf-tab-refresh-button");
    loginAsRefreshBtn.addEventListener("click", async () => {
      const resultsContainer = loginAsTabContent.querySelector(".sf-users-container-wrapper");
      const searchInputRef = modal.querySelector(".sf-modal-search-input");
      await fetchAndRenderLoginAsUsers(
        searchInputRef ? searchInputRef.value.trim() : "",
        resultsContainer,
        loginAsTabContent,
        true,
      );
    });
    loginAsRefreshContainer.appendChild(loginAsRefreshBtn);
    loginAsTabContent.appendChild(loginAsRefreshContainer);

    const loginAsResultsContainer = document.createElement("div");
    loginAsResultsContainer.classList.add("sf-users-container-wrapper");
    loginAsTabContent.appendChild(loginAsResultsContainer);

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Filter links or search users...";
    searchInput.classList.add("sf-modal-search-input");
    searchInput.addEventListener("input", (event) => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
      const searchValue = event.target.value.trim();
      const activeTabButton = document.querySelector(".sf-tab-button.sf-tab-active");
      const currentTab = activeTabButton ? activeTabButton.dataset.tab : "setup";
      const debounceDelay = currentTab === "loginas" ? 300 : 0;
      searchDebounceTimer = setTimeout(async () => {
        if (currentTab === "setup") {
          const currentCache = await retrieveOrCreateLinksCache();
          renderTagCloud(setupTabContent, currentCache, searchValue);
        } else if (currentTab === "objects") {
          const objectsCache = await retrieveOrCreateObjectsCache();
          renderObjectsCloud(objectsTabContent, objectsCache, searchValue);
        } else if (currentTab === "loginas") {
          fetchAndRenderLoginAsUsers(searchValue, loginAsResultsContainer, loginAsTabContent);
        }
      }, debounceDelay);
    });
    modal.appendChild(searchInput);

    modal.appendChild(setupTabContent);
    modal.appendChild(objectsTabContent);
    modal.appendChild(loginAsTabContent);

    const loadingIndicator = document.createElement("p");
    loadingIndicator.classList.add("sf-loading-indicator");
    loadingIndicator.style.display = "none";
    loadingIndicator.textContent = "Extracting more links...";
    modal.appendChild(loadingIndicator);

    const closeButton = document.createElement("button");
    closeButton.textContent = "Close";
    closeButton.classList.add("sf-modal-close-button");
    closeButton.addEventListener("click", () => {
      cleanupModal(modal);
    });
    modal.appendChild(closeButton);

    document.body.appendChild(modal);
    console.log("modal appended");
    searchInput.focus();
  }

  const loadingIndicator = modal.querySelector(".sf-loading-indicator");
  if (loadingIndicator) {
    loadingIndicator.style.display = isLoading ? "block" : "none";
  }

  const linksCache = await retrieveOrCreateLinksCache();
  const setupTabContentEl = modal.querySelector('.sf-tab-content[data-tab="setup"]');
  renderTagCloud(setupTabContentEl, linksCache, searchTerm);

  const objectsCache = await retrieveOrCreateObjectsCache();
  const objectsTabContentEl = modal.querySelector('.sf-tab-content[data-tab="objects"]');
  renderObjectsCloud(objectsTabContentEl, objectsCache, searchTerm);
}

function handleTabHoverStart(tabName) {
  const activeTabButton = document.querySelector(".sf-tab-button.sf-tab-active");
  if (activeTabButton && activeTabButton.dataset.tab === tabName) {
    return;
  }
  if (tabHoverTimer) {
    clearTimeout(tabHoverTimer);
  }
  tabHoverTimer = setTimeout(() => {
    switchTab(tabName);
  }, TAB_HOVER_DELAY_MS);
}

function handleTabHoverEnd() {
  if (tabHoverTimer) {
    clearTimeout(tabHoverTimer);
    tabHoverTimer = null;
  }
}

function switchTab(tabName) {
  const tabButtons = document.querySelectorAll(".sf-tab-button");
  tabButtons.forEach((btn) => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add("sf-tab-active");
    } else {
      btn.classList.remove("sf-tab-active");
    }
  });
  const tabContents = document.querySelectorAll(".sf-tab-content");
  tabContents.forEach((content) => {
    if (content.dataset.tab === tabName) {
      content.classList.add("sf-tab-active");
    } else {
      content.classList.remove("sf-tab-active");
    }
  });
  if (tabName === "loginas") {
    const loginAsTabContent = document.querySelector('.sf-tab-content[data-tab="loginas"]');
    const resultsContainer = loginAsTabContent
      ? loginAsTabContent.querySelector(".sf-users-container-wrapper")
      : null;
    const searchInput = document.querySelector(".sf-modal-search-input");
    if (searchInput) searchInput.focus();
    if (loginAsTabContent && resultsContainer && loginAsTabContent.dataset.loaded !== "true") {
      fetchAndRenderLoginAsUsers(
        searchInput ? searchInput.value.trim() : "",
        resultsContainer,
        loginAsTabContent,
      );
    }
    return;
  }
  const searchInput = document.querySelector(".sf-modal-search-input");
  if (searchInput) searchInput.focus();
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
  const cleanedId = recordId.trim();
  const recordUrl = `${window.location.origin}/${cleanedId}`;
  window.location.href = recordUrl;
}

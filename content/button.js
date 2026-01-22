/********* content/button.js **************/
function createButton() {
  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.classList.add("sf-go-home-setup-button");
  return button;
}

function updateButtonState() {
  const isOnSetup = SETUP_PATH_REGEX.test(window.location.pathname);
  if (!currentButton) {
    currentButton = document.getElementById(BUTTON_ID);
    if (!currentButton) {
      currentButton = createButton();
      document.body.appendChild(currentButton);
      console.log("Salesforce Go Home/Setup Extension: Button added.");
      buttonEventListenersAttached = false;
    }
  }
  if (currentButton && !buttonEventListenersAttached) {
    currentButton.addEventListener("click", handleButtonClick);
    currentButton.addEventListener("mouseenter", handleButtonHoverStart);
    currentButton.addEventListener("mouseleave", handleButtonHoverEnd);
    buttonEventListenersAttached = true;
  }
  if (currentButton) {
    currentButton.disabled = isExtracting;
    if (isOnSetup) {
      currentButton.textContent = isExtracting ? "⚙️ Extracting..." : "🏠 Go Home";
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
  const isOnSetup = SETUP_PATH_REGEX.test(window.location.pathname);
  const isOnObjectManager = window.location.pathname.includes("/lightning/setup/ObjectManager");
  if (isOnSetup) {
    updateButtonState();
    displaySetupTagCloud();
    if (isOnObjectManager) {
      let objectsCache = await retrieveOrCreateObjectsCache();
      if (await shouldRefreshObjectsCache()) {
        isExtracting = true;
        objectsCache = await extractObjectManagerObjects();
        isExtracting = false;
      }
    } else {
      let linksCache = await retrieveOrCreateLinksCache();
      if (await shouldRefreshCache()) {
        isExtracting = true;
        chrome.runtime.sendMessage({
          action: "requestSetupLinkExtraction",
          data: JSON.stringify(linksCache),
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

function handleButtonHoverStart() {
  if (modalIsCurrentlyOpen()) {
    return;
  }
  if (hoverTimer) {
    clearTimeout(hoverTimer);
  }
  hoverTimer = setTimeout(() => {
    if (!modalIsCurrentlyOpen()) {
      openModal();
    }
  }, BUTTON_HOVER_DELAY_MS);
}

function handleButtonHoverEnd() {
  if (hoverTimer) {
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }
}

function handleButtonClick(event) {
  event.preventDefault();
  if (isExtracting) return;
  if (hoverTimer) {
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }
  const isCtrlPressed = event.ctrlKey || event.metaKey;
  navigateToHome(isCtrlPressed);
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

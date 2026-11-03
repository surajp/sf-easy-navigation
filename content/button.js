/********* content/button.js **************/
function createButton() {
  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.classList.add("sf-go-home-setup-button");
  if (IS_PRODUCTION_ORG) {
    button.classList.add("sf-production-org");
  }
  return button;
}

function updateButtonState() {
  const isOnSetup = SETUP_PATH_REGEX.test(window.location.pathname);
  if (!currentButton) {
    currentButton = document.getElementById(BUTTON_ID) || createButton();
  }
  // Salesforce can replace page content; re-append the same element so its listeners survive
  if (!currentButton.isConnected) {
    document.body.appendChild(currentButton);
    console.log("Salesforce Go Home/Setup Extension: Button added.");
  }
  if (!buttonEventListenersAttached) {
    currentButton.addEventListener("click", handleButtonClick);
    currentButton.addEventListener("mouseenter", handleButtonHoverStart);
    currentButton.addEventListener("mouseleave", handleButtonHoverEnd);
    buttonEventListenersAttached = true;
  }
  if (currentButton) {
    currentButton.disabled = isExtracting;
    let buttonTitle;
    if (isOnSetup) {
      currentButton.textContent = isExtracting ? "⚙️" : "🏠";
      buttonTitle = isExtracting ? "Extracting..." : "Go Home";
    } else {
      currentButton.textContent = "⚙️";
      buttonTitle = "Go To Setup";
    }
    currentButton.title = IS_PRODUCTION_ORG ? `${buttonTitle} (PRODUCTION org)` : buttonTitle;
  }
}

async function openModal() {
  if (currentButton) currentButton.classList.remove("loading");
  if (isExtracting) {
    console.log("Extraction already in progress.");
    return;
  }
  const isOnSetup = SETUP_PATH_REGEX.test(window.location.pathname);
  const isOnObjectManager = window.location.pathname.includes("/lightning/setup/ObjectManager");
  if (isOnObjectManager) {
    // Show cached objects while the table auto-scrolls
    displaySetupTagCloud();
    if (await shouldRefreshObjectsCache()) {
      await extractObjectManagerObjects();
    }
  }
  // Always open, even with empty caches: the empty states explain how to populate them,
  // and the Login As tab and record navigation work anywhere
  updateButtonState();
  await displaySetupTagCloud();
  if (isOnSetup && !isOnObjectManager && (await shouldRefreshCache())) {
    await startSetupLinkExtraction();
  }
}

function handleButtonHoverStart() {
  if (modalIsCurrentlyOpen()) {
    return;
  }
  if (currentButton) currentButton.classList.add("loading");
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
  if (currentButton) currentButton.classList.remove("loading");
  if (hoverTimer) {
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }
}

function handleButtonClick(event) {
  event.preventDefault();
  if (currentButton) currentButton.classList.remove("loading");
  if (isExtracting) return;
  if (hoverTimer) {
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }
  const isCtrlPressed = event.ctrlKey || event.metaKey;
  navigateToHome(isCtrlPressed);
}

function navigateToHome(isCtrlPressed) {
  const isOnSetup = SETUP_PATH_REGEX.test(window.location.pathname);
  const urlToNavigate = `${window.location.origin}${isOnSetup ? HOME_PATH : SETUP_HOME_PATH}`;
  if (isCtrlPressed) {
    window.open(urlToNavigate, "_blank");
  } else {
    window.location.href = urlToNavigate;
  }
}

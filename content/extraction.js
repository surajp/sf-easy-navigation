/********* content/extraction.js **************/
async function performAsyncTaskExtraction(initialLinksCache) {
  console.log("Starting asynchronous link extraction...");
  let linksCache = { ...initialLinksCache };
  const clickedButtons = new Set();
  displaySetupTagCloud("", true);
  try {
    let buttonsToClick = findClickableSetupButtons(clickedButtons);
    while (buttonsToClick.length > 0) {
      console.log(`Found ${buttonsToClick.length} buttons to click.`);
      for (const button of buttonsToClick) {
        if (clickedButtons.has(button)) continue;
        console.log("Clicking button:", button.textContent || button.ariaLabel || button);
        button.click();
        clickedButtons.add(button);
        await delay(200);
        extractVisibleLinks(linksCache);
      }
      buttonsToClick = findClickableSetupButtons(clickedButtons);
      await saveLinksCache(linksCache, false);
      displaySetupTagCloud(
        document.querySelector(`#${MODAL_ID} .sf-modal-search-input`)?.value || "",
        true,
      );
    }
  } catch (error) {
    console.error("Error during asynchronous extraction:", error);
  } finally {
    extractVisibleLinks(linksCache);
    await saveLinksCache(linksCache, true);
    isExtracting = false;
    updateButtonState();
    displaySetupTagCloud(
      document.querySelector(`#${MODAL_ID} .sf-modal-search-input`)?.value || "",
      false,
    );
  }
}

function findClickableSetupButtons(alreadyClicked) {
  const parentNodes = document.body.querySelectorAll("li[data-placement='parent']");
  const potentialButtons = [];
  for (const node of parentNodes) {
    const button = node.querySelector("button.slds-button[title='Expand']");
    if (button && isElementVisible(button) && !alreadyClicked.has(button)) {
      potentialButtons.push(button);
    }
  }
  return potentialButtons;
}

function extractVisibleLinks(linksCache) {
  document.body.querySelectorAll("li[data-placement='leaf']").forEach((leafNode) => {
    const link = leafNode.querySelector("a.slds-tree__item-label");
    if (!link) return;
    const label = link.textContent?.trim();
    const href = link.href;
    if (label && href && !href.startsWith("javascript:") && !href.startsWith("#")) {
      const parentLabel = [];
      let parentNode = leafNode.closest("li[data-placement='parent']");
      while (parentNode) {
        parentLabel.unshift(
          parentNode.querySelector("a.slds-tree__item-label").textContent.trim(),
        );
        parentNode = parentNode.parentElement?.closest("li[data-placement='parent']");
      }
      const parentLabelText = parentLabel.join(" > ");
      const fullKey = `${parentLabelText} > ${label}`;
      linksCache[fullKey] = linksCache[fullKey] || {};
      linksCache[fullKey].href = href;
      linksCache[fullKey].parentLabel = parentLabelText;
      linksCache[fullKey].label = label;
    }
  });
}

function isElementVisible(el) {
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

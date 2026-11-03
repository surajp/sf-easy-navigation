/********* content/objects.js **************/
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
    const parentNode = document.querySelector("div.objectManagerObjectList");
    const objectTable = parentNode?.querySelector("table.slds-table");
    if (!objectTable) {
      console.warn("Object Manager table not found");
      return objectsCache;
    }
    console.log("scrolling now...");
    let lastScrollTop = -1;
    const scroller = parentNode.querySelector("div.scroller");
    while (true) {
      const scrollTop = scroller.scrollTop || 0;
      if (scrollTop === lastScrollTop) {
        break;
      }
      lastScrollTop = scrollTop;
      scroller.scrollBy(0, window.innerHeight);
      await delay(1000);
    }
    // Rebuild from scratch, keyed by href: labels aren't unique (e.g. a custom object and a
    // managed-package object can share one), and old label-keyed entries would duplicate
    const extractedObjects = {};
    const objectRows = objectTable.querySelectorAll("tbody tr");
    objectRows.forEach((row) => {
      const linkElement = row.querySelector("th a");
      if (!linkElement) return;
      const label = linkElement.textContent.trim();
      const href = linkElement.href;
      if (label && href) {
        extractedObjects[href] = { label, href };
      }
    });
    if (Object.keys(extractedObjects).length === 0) {
      console.warn("No objects found in Object Manager table; keeping existing cache");
      return objectsCache;
    }
    objectsCache = extractedObjects;
    await saveObjectsCache(objectsCache, true);
    console.log(`Extracted ${Object.keys(objectsCache).length} objects from Object Manager`);
    return objectsCache;
  } catch (error) {
    console.error("Error extracting objects from Object Manager:", error);
    return objectsCache;
  } finally {
    isExtracting = false;
    updateButtonState();
  }
}

/********* content/init.js **************/
updateButtonState();
setInterval(updateButtonState, 1000);

const bodyObserver = new MutationObserver(() => {
  if (!document.getElementById(BUTTON_ID) && !isExtracting) {
    console.log("Salesforce Go Home/Setup Extension: Body changed, ensuring button exists.");
    updateButtonState();
  }
});
bodyObserver.observe(document.body, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  console.log("received message in content script:", request.action);
  if (request.action === "beginAsyncLinkExtraction") {
    const initialCache = JSON.parse(request.data || "{}");
    performAsyncTaskExtraction(initialCache);
  } else if (request.action === "setupLinksExtracted") {
    console.warn("Received setupLinksExtracted message, may be handled differently now.");
    const linksCache = JSON.parse(request.data);
    await saveLinksCache(linksCache);
    displaySetupTagCloud("", isExtracting);
  }
});

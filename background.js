/**************** background.js **************************/

function getSalesforceDomainFromUrl(tabUrl) {
  let salesforceDomain = tabUrl.hostname;

  // Convert Lightning domain to Classic/API domain
  if (salesforceDomain.includes(".lightning.force.com")) {
    const instanceName = salesforceDomain.split(".")[0];

    // Determine if it's a sandbox by checking for "--" in the instance name
    if (instanceName.includes("--")) {
      salesforceDomain = `${instanceName}.sandbox.my.salesforce.com`;
    } else {
      salesforceDomain = `${instanceName}.my.salesforce.com`;
    }
  }
  return salesforceDomain;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "requestSetupLinkExtraction") {
    console.log(
      "Background: Received request to start link extraction from tab",
      sender.tab.id,
    );
    // Simply tell the content script to begin its own asynchronous process
    chrome.tabs.sendMessage(sender.tab.id, {
      action: "beginAsyncLinkExtraction",
      data: request.data,
    });
    return;
  }

  if (request.action === "getSessionCookie") {
    let targetUrl;
    try {
      targetUrl = new URL(request.url || sender?.tab?.url || "");
    } catch (error) {
      console.error("Invalid URL provided for session lookup", error);
      sendResponse({ error: "Unable to determine Salesforce domain." });
      return;
    }

    const salesforceDomain =
      getSalesforceDomainFromUrl(targetUrl) || targetUrl.hostname;

    chrome.cookies.get(
      {
        url: `https://${salesforceDomain}`,
        name: "sid",
      },
      (cookie) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
          return;
        }
        if (!cookie?.value) {
          sendResponse({ error: "Session cookie not found." });
          return;
        }
        sendResponse({ sessionId: cookie.value });
      },
    );
    return true;
  }
  // Keep other message listeners if needed
});

/******************* end of background.js *****************/

/**************** background.js **************************/

// Keep in sync with toMyDomainHostname in content/api.js
function getSalesforceDomainFromUrl(tabUrl) {
  // Swap only the suffix so org-type segments survive
  // (e.g. acme--uat.sandbox, acme-dev-ed.develop, x.scratch)
  return tabUrl.hostname
    .replace(/\.lightning\.force\.com$/, ".my.salesforce.com")
    .replace(/\.my\.salesforce-setup\.com$/, ".my.salesforce.com");
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
});

/******************* end of background.js *****************/

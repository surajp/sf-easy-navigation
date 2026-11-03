/********* content/api.js **************/
// --- My Domain resolution ---
// Swap only the suffix so org-type segments survive
// (e.g. acme--uat.sandbox, acme-dev-ed.develop, x.scratch).
// Keep in sync with getSalesforceDomainFromUrl in background.js
function toMyDomainHostname(hostname) {
  return hostname
    .replace(/\.lightning\.force\.com$/, ".my.salesforce.com")
    .replace(/\.my\.salesforce-setup\.com$/, ".my.salesforce.com");
}

function getSalesforceApiOrigin() {
  return `https://${toMyDomainHostname(window.location.hostname)}`;
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
    throw new Error(
      "No session found. Please ensure you're logged into Salesforce.",
    );
  }
  const apiOrigin = getSalesforceApiOrigin();
  const firstPage = await fetchQueryPage(
    `${apiOrigin}/services/data/v${SALESFORCE_API_VERSION}/query?q=${encodeURIComponent(soqlQuery)}`,
    sessionId,
  );
  // REST returns at most ~2000 rows per page; follow nextRecordsUrl so LIMITs above that are honored
  const records = [...(firstPage.records || [])];
  let nextRecordsUrl = firstPage.nextRecordsUrl;
  while (nextRecordsUrl) {
    const page = await fetchQueryPage(`${apiOrigin}${nextRecordsUrl}`, sessionId);
    records.push(...(page.records || []));
    nextRecordsUrl = page.nextRecordsUrl;
  }
  return { ...firstPage, records, done: true, nextRecordsUrl: undefined };
}

async function fetchQueryPage(url, sessionId) {
  const response = await fetch(url, {
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
      throw new Error(
        "Permission denied. Ensure you have 'Manage Users' permissions.",
      );
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
    const result = await executeSoqlQuery(
      "SELECT Id FROM Organization LIMIT 1",
    );
    orgIdCache =
      result.records && result.records.length ? result.records[0].Id : null;
    return orgIdCache;
  } catch (error) {
    console.error("Error fetching org ID:", error);
    throw error;
  }
}

async function searchUsers(searchTerm = "") {
  const fields = "Id, Name, Email, Username, LastLoginDate, IsActive";
  // Escape backslashes first, then quotes and LIKE wildcards, so input can't break out of the string
  const sanitizedTerm = searchTerm
    .trim()
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/[%_]/g, "\\$&");
  let query = `SELECT ${fields} FROM User WHERE IsActive = true AND UserType = 'Standard'`;
  if (sanitizedTerm) {
    const likeTerm = `%${sanitizedTerm}%`;
    query += ` AND (Name LIKE '${likeTerm}' OR Email LIKE '${likeTerm}' OR Username LIKE '${likeTerm}')`;
    query += " ORDER BY Name ASC LIMIT 50";
  } else {
    query += " ORDER BY LastLoginDate DESC NULLS LAST LIMIT 5000";
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
  const currentPath =
    window.location.pathname + window.location.search + window.location.hash;
  const encodedPath = encodeURIComponent(currentPath || "/");
  const baseUrl = getSalesforceApiOrigin();
  return `${baseUrl}/servlet/servlet.su?oid=${orgId}&suorgadminid=${targetUserId}&retURL=${encodedPath}&targetURL=${encodedPath}`;
}

function getUserDetailPageUrl(userId) {
  return `/lightning/setup/ManageUsersLightning/page?address=%2F${userId}%3Fnoredirect%3D1%26isUserEntityOverride%3D1%26retURL%3D%252Fsetup%252Fhome`;
}

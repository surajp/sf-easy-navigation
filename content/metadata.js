/********* content/metadata.js **************/
// --- Metadata search (Metadata tab) ---
// The user picks one metadata type, and each search runs one live query for that type.
// Nothing is cached: results exist only in the rendered list.

const METADATA_RESULT_LIMIT = 50;

function setupAddressUrl(setupNode, recordId) {
  return `${window.location.origin}/lightning/setup/${setupNode}/page?address=${encodeURIComponent(`/${recordId}`)}`;
}

function joinDetails(...parts) {
  return parts.filter(Boolean).join(" · ");
}

function namespaceDetail(record) {
  return record.NamespacePrefix ? `Namespace: ${record.NamespacePrefix}` : "";
}

// Each type: which object to query (and whether via the Tooling API), which name fields to match,
// and how to turn a record into { name, apiName, details, url, inactiveLabel }.
// inactiveLabel (e.g. "Inactive") is set only for types with an active state, when the item is off.
// searchFields may only list several fields where the object supports OR (FlowDefinitionView and
// EntityDefinition reject it, so they search their label only).
const METADATA_TYPES = [
  {
    key: "apexClasses",
    label: "Apex Classes",
    useToolingApi: true,
    sObject: "ApexClass",
    fields: "Id, Name, NamespacePrefix",
    searchFields: ["Name"],
    orderBy: "Name",
    toResult: (record) => ({
      name: record.Name,
      details: namespaceDetail(record),
      url: setupAddressUrl("ApexClasses", record.Id),
    }),
  },
  {
    key: "apexTriggers",
    label: "Apex Triggers",
    useToolingApi: true,
    sObject: "ApexTrigger",
    fields: "Id, Name, TableEnumOrId, Status, NamespacePrefix",
    searchFields: ["Name"],
    orderBy: "Name",
    toResult: (record) => ({
      name: record.Name,
      details: joinDetails(record.TableEnumOrId, namespaceDetail(record)),
      // Status can be Active, Inactive or Deleted
      inactiveLabel: record.Status === "Active" ? null : record.Status,
      url: setupAddressUrl("ApexTriggers", record.Id),
    }),
  },
  {
    key: "flows",
    label: "Flows",
    useToolingApi: false,
    sObject: "FlowDefinitionView",
    fields: "DurableId, ApiName, Label, ProcessType, ActiveVersionId",
    searchFields: ["Label"],
    orderBy: "Label",
    // DurableId is the FlowDefinition (300...) ID, whose detail page lists all versions
    toResult: (record) => ({
      name: record.Label,
      apiName: record.ApiName,
      details: joinDetails(record.ApiName, record.ProcessType),
      inactiveLabel: record.ActiveVersionId ? null : "Inactive",
      url: setupAddressUrl("Flows", record.DurableId),
    }),
  },
  {
    key: "lightningWebComponents",
    label: "Lightning Web Components",
    useToolingApi: true,
    sObject: "LightningComponentBundle",
    fields: "Id, DeveloperName, MasterLabel, NamespacePrefix",
    searchFields: ["DeveloperName", "MasterLabel"],
    orderBy: "DeveloperName",
    toResult: (record) => ({
      name: record.DeveloperName,
      apiName: record.MasterLabel,
      details: joinDetails(record.MasterLabel !== record.DeveloperName ? record.MasterLabel : "", namespaceDetail(record)),
      url: setupAddressUrl("LightningComponentBundles", record.Id),
    }),
  },
  {
    key: "auraComponents",
    label: "Aura Components",
    useToolingApi: true,
    sObject: "AuraDefinitionBundle",
    fields: "Id, DeveloperName, MasterLabel, NamespacePrefix",
    searchFields: ["DeveloperName", "MasterLabel"],
    orderBy: "DeveloperName",
    toResult: (record) => ({
      name: record.DeveloperName,
      apiName: record.MasterLabel,
      details: joinDetails(record.MasterLabel !== record.DeveloperName ? record.MasterLabel : "", namespaceDetail(record)),
      url: setupAddressUrl("LightningComponentBundles", record.Id),
    }),
  },
  {
    key: "permissionSets",
    label: "Permission Sets",
    useToolingApi: false,
    sObject: "PermissionSet",
    fields: "Id, Name, Label, NamespacePrefix",
    // Exclude the hidden permission sets behind profiles and permission set groups
    baseFilter: "IsOwnedByProfile = false AND PermissionSetGroupId = null",
    // PermissionSet queries fail (EXTERNAL_OBJECT_EXCEPTION) on an escaped apostrophe
    apostropheAsWildcard: true,
    searchFields: ["Label", "Name"],
    orderBy: "Label",
    toResult: (record) => ({
      name: record.Label,
      apiName: record.Name,
      details: joinDetails(record.Name, namespaceDetail(record)),
      url: setupAddressUrl("PermissionSetListView", record.Id),
    }),
  },
  {
    key: "permissionSetGroups",
    label: "Permission Set Groups",
    useToolingApi: false,
    sObject: "PermissionSetGroup",
    fields: "Id, DeveloperName, MasterLabel",
    searchFields: ["MasterLabel", "DeveloperName"],
    orderBy: "MasterLabel",
    toResult: (record) => ({
      name: record.MasterLabel,
      apiName: record.DeveloperName,
      details: record.DeveloperName,
      url: setupAddressUrl("PermSetGroups", record.Id),
    }),
  },
  {
    key: "profiles",
    label: "Profiles",
    useToolingApi: false,
    sObject: "Profile",
    fields: "Id, Name",
    searchFields: ["Name"],
    orderBy: "Name",
    toResult: (record) => ({
      name: record.Name,
      details: "",
      url: setupAddressUrl("EnhancedProfiles", record.Id),
    }),
  },
  {
    key: "customLabels",
    label: "Custom Labels",
    useToolingApi: true,
    sObject: "ExternalString",
    fields: "Id, Name, MasterLabel, NamespacePrefix",
    searchFields: ["Name", "MasterLabel"],
    orderBy: "Name",
    toResult: (record) => ({
      name: record.Name,
      apiName: record.MasterLabel,
      details: joinDetails(record.MasterLabel, namespaceDetail(record)),
      url: setupAddressUrl("ExternalStrings", record.Id),
    }),
  },
  {
    key: "customMetadataTypes",
    label: "Custom Metadata Types",
    useToolingApi: false,
    sObject: "EntityDefinition",
    fields: "DurableId, QualifiedApiName, Label",
    // "_" is a LIKE wildcard, so this matches any name ending in "__mdt" (plus a negligible superset)
    baseFilter: "QualifiedApiName LIKE '%__mdt'",
    searchFields: ["Label"],
    orderBy: "Label",
    toResult: (record) => ({
      name: record.Label,
      apiName: record.QualifiedApiName,
      details: record.QualifiedApiName,
      url: setupAddressUrl("CustomMetadata", record.DurableId),
    }),
  },
  {
    key: "visualforcePages",
    label: "Visualforce Pages",
    useToolingApi: true,
    sObject: "ApexPage",
    fields: "Id, Name, MasterLabel, NamespacePrefix",
    searchFields: ["Name", "MasterLabel"],
    orderBy: "Name",
    toResult: (record) => ({
      name: record.Name,
      apiName: record.MasterLabel,
      details: joinDetails(record.MasterLabel !== record.Name ? record.MasterLabel : "", namespaceDetail(record)),
      url: setupAddressUrl("ApexPages", record.Id),
    }),
  },
  {
    key: "staticResources",
    label: "Static Resources",
    useToolingApi: true,
    sObject: "StaticResource",
    fields: "Id, Name, NamespacePrefix",
    searchFields: ["Name"],
    orderBy: "Name",
    toResult: (record) => ({
      name: record.Name,
      details: namespaceDetail(record),
      url: setupAddressUrl("StaticResources", record.Id),
    }),
  },
  {
    key: "validationRules",
    label: "Validation Rules",
    useToolingApi: true,
    sObject: "ValidationRule",
    fields: "Id, ValidationName, Active, EntityDefinitionId, EntityDefinition.QualifiedApiName",
    searchFields: ["ValidationName"],
    orderBy: "ValidationName",
    // EntityDefinitionId is the object's Object Manager URL segment (API name or 01I... ID)
    toResult: (record) => ({
      name: record.ValidationName,
      details: record.EntityDefinition?.QualifiedApiName,
      inactiveLabel: record.Active ? null : "Inactive",
      url: `${window.location.origin}/lightning/setup/ObjectManager/${encodeURIComponent(record.EntityDefinitionId)}/ValidationRules/${record.Id}/view`,
    }),
  },
];

function getSelectedMetadataType() {
  return METADATA_TYPES.find((type) => type.key === selectedMetadataTypeKey) || METADATA_TYPES[0];
}

function buildMetadataQuery(metadataType, searchTerm) {
  const conditions = [];
  if (metadataType.baseFilter) conditions.push(metadataType.baseFilter);
  let escapedTerm = escapeSoqlLikeTerm(searchTerm);
  if (metadataType.apostropheAsWildcard) {
    // "_" matches any single character, including the apostrophe
    escapedTerm = escapedTerm.replace(/\\'/g, "_");
  }
  if (escapedTerm) {
    const likeClauses = metadataType.searchFields.map((field) => `${field} LIKE '%${escapedTerm}%'`);
    conditions.push(likeClauses.length > 1 ? `(${likeClauses.join(" OR ")})` : likeClauses[0]);
  }
  const whereClause = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
  return `SELECT ${metadataType.fields} FROM ${metadataType.sObject}${whereClause} ORDER BY ${metadataType.orderBy} LIMIT ${METADATA_RESULT_LIMIT}`;
}

function cancelPendingMetadataSearch() {
  if (metadataSearchAbortController) {
    metadataSearchAbortController.abort();
    metadataSearchAbortController = null;
  }
}

async function fetchAndRenderMetadata(searchTerm, resultsContainer) {
  if (!resultsContainer) return;
  // Only the newest search may render; older in-flight requests are cancelled
  cancelPendingMetadataSearch();
  const abortController = new AbortController();
  metadataSearchAbortController = abortController;
  const metadataType = getSelectedMetadataType();

  resultsContainer.innerHTML = "";
  const loadingWrapper = document.createElement("div");
  loadingWrapper.classList.add("sf-loading-spinner");
  loadingWrapper.innerHTML = '<div class="sf-spinner"></div>';
  const loadingText = document.createElement("p");
  loadingText.textContent = `Searching ${metadataType.label}...`;
  loadingWrapper.appendChild(loadingText);
  resultsContainer.appendChild(loadingWrapper);

  try {
    const result = await executeSoqlQuery(buildMetadataQuery(metadataType, searchTerm), abortController.signal, {
      useToolingApi: metadataType.useToolingApi,
    });
    if (abortController.signal.aborted) return;
    renderMetadataResults(resultsContainer, metadataType, result.records.map(metadataType.toResult), searchTerm);
  } catch (error) {
    if (error.name === "AbortError") return;
    console.error(`Error searching ${metadataType.label}:`, error);
    resultsContainer.innerHTML = "";
    const errorMessage = document.createElement("p");
    errorMessage.classList.add("sf-error-message");
    errorMessage.textContent = `Couldn't search ${metadataType.label}: ${error.message}`;
    resultsContainer.appendChild(errorMessage);
  } finally {
    if (metadataSearchAbortController === abortController) {
      metadataSearchAbortController = null;
    }
  }
}

function renderMetadataResults(resultsContainer, metadataType, results, searchTerm) {
  resultsContainer.innerHTML = "";
  if (results.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.classList.add("sf-empty-message");
    emptyMessage.textContent = searchTerm
      ? `No ${metadataType.label.toLowerCase()} match "${searchTerm}".`
      : `No ${metadataType.label.toLowerCase()} found.`;
    resultsContainer.appendChild(emptyMessage);
    return;
  }

  // The server only filters by "contains"; rank exact and prefix matches first
  const rankedResults = results
    .map((result) => ({ result, score: scoreNameMatch([result.name, result.apiName], searchTerm) }))
    .sort((a, b) => b.score - a.score || a.result.name.localeCompare(b.result.name));

  const summary = document.createElement("p");
  summary.classList.add("sf-metadata-summary");
  summary.textContent =
    results.length >= METADATA_RESULT_LIMIT
      ? `Showing the first ${METADATA_RESULT_LIMIT} ${metadataType.label.toLowerCase()}; type to narrow the list`
      : `${results.length} ${metadataType.label.toLowerCase()}`;
  resultsContainer.appendChild(summary);

  for (const { result } of rankedResults) {
    const resultItem = document.createElement("div");
    resultItem.classList.add("sf-metadata-item");

    const resultLink = document.createElement("a");
    resultLink.href = result.url;
    resultLink.textContent = result.name;
    resultLink.classList.add("sf-metadata-link");
    resultLink.addEventListener("click", (event) => navigateFromModal(event, resultLink.href));

    if (result.inactiveLabel) {
      // Greyed out plus a text badge, so the state doesn't rely on colour alone
      resultItem.classList.add("sf-metadata-inactive");
      const nameRow = document.createElement("div");
      nameRow.classList.add("sf-metadata-name-row");
      nameRow.appendChild(resultLink);
      const inactiveBadge = document.createElement("span");
      inactiveBadge.classList.add("sf-metadata-inactive-badge");
      inactiveBadge.textContent = result.inactiveLabel;
      nameRow.appendChild(inactiveBadge);
      resultItem.appendChild(nameRow);
    } else {
      resultItem.appendChild(resultLink);
    }

    if (result.details) {
      const resultDetails = document.createElement("span");
      resultDetails.classList.add("sf-metadata-details");
      resultDetails.textContent = result.details;
      resultItem.appendChild(resultDetails);
    }
    resultsContainer.appendChild(resultItem);
  }
}

// Type chips: clicking one selects that type and re-runs the current search for it
function createMetadataTypeChips(resultsContainer) {
  const chipRow = document.createElement("div");
  chipRow.classList.add("sf-metadata-type-chips");
  for (const metadataType of METADATA_TYPES) {
    const chip = document.createElement("button");
    chip.classList.add("sf-metadata-type-chip");
    chip.textContent = metadataType.label;
    chip.dataset.metadataType = metadataType.key;
    if (metadataType.key === getSelectedMetadataType().key) {
      chip.classList.add("sf-metadata-type-active");
    }
    chip.addEventListener("click", () => {
      selectedMetadataTypeKey = metadataType.key;
      chipRow.querySelectorAll(".sf-metadata-type-chip").forEach((otherChip) => {
        otherChip.classList.toggle("sf-metadata-type-active", otherChip === chip);
      });
      const searchInput = document.querySelector(`#${MODAL_ID} .sf-modal-search-input`);
      fetchAndRenderMetadata(searchInput ? searchInput.value.trim() : "", resultsContainer);
      if (searchInput) searchInput.focus();
    });
    chipRow.appendChild(chip);
  }
  return chipRow;
}

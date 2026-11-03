/********* content/fields.js **************/
// --- Field search ---
// Typing "Object.field" in the Object Manager tab (e.g. "Account.ind") lists that object's fields.
// An object's fields are fetched live once per object (one FieldDefinition query, ~100-200ms) and
// held only in memory while the modal is open, so typing the field part filters instantly.
// Nothing is written to storage; cleanupModal discards the list.

// Returned by FieldDefinition but not listed in Object Manager, so they have no setup page
const HIDDEN_SYSTEM_FIELDS = new Set([
  "Id",
  "IsDeleted",
  "MasterRecordId",
  "SystemModstamp",
  "LastViewedDate",
  "LastReferencedDate",
  "UserRecordAccessId",
]);

function parseFieldSearchTerm(searchTerm) {
  const dotIndex = searchTerm.indexOf(".");
  if (dotIndex <= 0) return null;
  return {
    objectTerm: searchTerm.slice(0, dotIndex).trim(),
    fieldTerm: searchTerm.slice(dotIndex + 1).trim(),
  };
}

// Object Manager URLs identify objects by API name (standard) or 01I... ID (custom)
function getObjectManagerSegment(objectHref) {
  const match = objectHref.match(/\/ObjectManager\/([A-Za-z0-9_]+)(?:\/|$)/);
  return match ? match[1] : null;
}

function normalizeObjectName(value) {
  return value.toLowerCase().replace(/__c$/, "").replace(/[\s_]+/g, "");
}

const MAX_OBJECT_SUGGESTIONS = 8;

// Match the typed object against labels and URL segments ("order_line_item__c" matches "Order Line Item").
// Returns { object } when exactly one matches, otherwise { suggestions } to pick from.
function resolveObjectForFieldSearch(objects, objectTerm) {
  const term = normalizeObjectName(objectTerm);
  if (!term) return { object: null, suggestions: [] };
  const candidates = Object.values(objects);
  const exactMatches = candidates.filter(
    (object) =>
      normalizeObjectName(object.label) === term ||
      normalizeObjectName(getObjectManagerSegment(object.href) || "") === term,
  );
  if (exactMatches.length === 1) return { object: exactMatches[0], suggestions: [] };
  const prefixMatches = candidates.filter((object) => normalizeObjectName(object.label).startsWith(term));
  if (exactMatches.length === 0 && prefixMatches.length === 1) {
    return { object: prefixMatches[0], suggestions: [] };
  }
  const suggestions = (exactMatches.length > 1 ? exactMatches : prefixMatches)
    .sort((a, b) => a.label.length - b.label.length || a.label.localeCompare(b.label))
    .slice(0, MAX_OBJECT_SUGGESTIONS);
  return { object: null, suggestions };
}

// EntityDefinitionId values are API names (standard) or 15-character 01I... IDs (custom);
// Object Manager URLs may carry the 18-character form
function toEntityDefinitionId(objectSegment) {
  return /^01I[A-Za-z0-9]{15}$/.test(objectSegment) ? objectSegment.slice(0, 15) : objectSegment;
}

async function fetchObjectFields(objectSegment, signal) {
  const entityId = toEntityDefinitionId(objectSegment);
  const result = await executeSoqlQuery(
    `SELECT QualifiedApiName, Label, DurableId, DataType FROM FieldDefinition WHERE EntityDefinitionId = '${entityId}'`,
    signal,
  );
  return result.records
    .filter((field) => !HIDDEN_SYSTEM_FIELDS.has(field.QualifiedApiName))
    .map((field) => ({
      label: field.Label,
      apiName: field.QualifiedApiName,
      dataType: field.DataType,
      // DurableId is "<object>.<field>"; the field part is its Object Manager URL segment
      // (API name for standard fields, 00N... ID for custom fields)
      urlSegment: field.DurableId.slice(field.DurableId.lastIndexOf(".") + 1),
    }));
}

// Reuses the in-flight or finished request while the same object is being searched
function loadFieldsForObject(objectSegment) {
  if (_modalFieldList?.objectSegment === objectSegment) {
    return _modalFieldList.fieldsPromise;
  }
  clearModalFieldList();
  const abortController = new AbortController();
  const fieldsPromise = fetchObjectFields(objectSegment, abortController.signal);
  _modalFieldList = { objectSegment, fieldsPromise, abortController };
  // Forget failed requests so the next keystroke retries
  fieldsPromise.catch(() => {
    if (_modalFieldList?.fieldsPromise === fieldsPromise) _modalFieldList = null;
  });
  return fieldsPromise;
}

function clearModalFieldList() {
  if (_modalFieldList) {
    _modalFieldList.abortController.abort();
    _modalFieldList = null;
  }
}

// Fuzzy score in [1, 2) when the term's letters appear in order, else 0.
// Tighter matches and matches starting at a word rank higher ("stg" prefers "Stage" over "Days In Stage").
function fuzzyMatchScore(term, text) {
  let bestScore = 0;
  for (let start = text.indexOf(term[0]); start !== -1; start = text.indexOf(term[0], start + 1)) {
    let termIndex = 1;
    let position = start;
    while (termIndex < term.length) {
      position = text.indexOf(term[termIndex], position + 1);
      if (position === -1) break;
      termIndex++;
    }
    // If the letters don't fit after this start, they won't fit after any later one
    if (termIndex < term.length) break;
    const tightness = term.length / (position - start + 1);
    // Matching from the very start beats matching from a later word ("stg": "Stage" over "Days In Stage")
    let startBonus = 0;
    if (start === 0) startBonus = 0.3;
    else if (/[\s_]/.test(text[start - 1])) startBonus = 0.15;
    bestScore = Math.max(bestScore, 1 + 0.5 * tightness + startBonus);
  }
  return bestScore;
}

// 4 exact, 3 prefix, 2 contains, 1-2 fuzzy, 0 no match; best score across the given names.
// Shared by field search and metadata search.
function scoreNameMatch(names, searchTerm) {
  if (!searchTerm) return 1;
  const term = searchTerm.toLowerCase();
  let bestScore = 0;
  for (const name of names) {
    if (!name) continue;
    const candidate = name.toLowerCase();
    if (candidate === term) bestScore = Math.max(bestScore, 4);
    else if (candidate.startsWith(term)) bestScore = Math.max(bestScore, 3);
    else if (candidate.includes(term)) bestScore = Math.max(bestScore, 2);
    else bestScore = Math.max(bestScore, fuzzyMatchScore(term, candidate));
  }
  return bestScore;
}

function appendFieldSearchMessage(resultsContainer, text, isError = false) {
  const message = document.createElement("p");
  message.classList.add(isError ? "sf-error-message" : "sf-empty-message");
  message.textContent = text;
  resultsContainer.appendChild(message);
  return message;
}

// Clicking a suggestion rewrites the search as "<label>.<field term>" and re-runs it
function appendObjectSuggestions(resultsContainer, suggestions, fieldTerm) {
  const suggestionRow = document.createElement("div");
  suggestionRow.classList.add("sf-field-object-suggestions");
  for (const object of suggestions) {
    // Objects sharing a label are told apart by their URL segment (API name or 01I... ID)
    const objectSegment = getObjectManagerSegment(object.href);
    const hasDuplicateLabel = suggestions.some((other) => other !== object && other.label === object.label);
    const objectTermToUse = hasDuplicateLabel && objectSegment ? objectSegment : object.label;
    const suggestionButton = document.createElement("button");
    suggestionButton.classList.add("sf-field-object-suggestion");
    suggestionButton.textContent = hasDuplicateLabel ? `${object.label} (${objectSegment})` : object.label;
    suggestionButton.addEventListener("click", () => {
      const searchInput = document.querySelector(`#${MODAL_ID} .sf-modal-search-input`);
      if (!searchInput) return;
      searchInput.value = `${objectTermToUse}.${fieldTerm}`;
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      searchInput.focus();
    });
    suggestionRow.appendChild(suggestionButton);
  }
  resultsContainer.appendChild(suggestionRow);
}

async function renderFieldSearchResults(resultsContainer, objects, { objectTerm, fieldTerm }) {
  const { object: targetObject, suggestions } = resolveObjectForFieldSearch(objects, objectTerm);
  if (!targetObject) {
    if (suggestions.length > 0) {
      appendFieldSearchMessage(resultsContainer, `Which object did you mean by "${objectTerm}"?`);
      appendObjectSuggestions(resultsContainer, suggestions, fieldTerm);
    } else {
      appendFieldSearchMessage(
        resultsContainer,
        `No object matches "${objectTerm}". Type an object's label or API name, then a dot and the field, e.g. Account.Industry`,
      );
    }
    return;
  }
  const objectSegment = getObjectManagerSegment(targetObject.href);
  if (!objectSegment) {
    appendFieldSearchMessage(resultsContainer, `Can't determine the setup page for ${targetObject.label}.`, true);
    return;
  }

  const loadingMessage = appendFieldSearchMessage(resultsContainer, `Loading fields for ${targetObject.label}...`);
  let fields;
  try {
    fields = await loadFieldsForObject(objectSegment);
  } catch (error) {
    if (error.name === "AbortError") return;
    console.error(`Error loading fields for ${targetObject.label}:`, error);
    loadingMessage.remove();
    appendFieldSearchMessage(resultsContainer, `Couldn't load fields: ${error.message}`, true);
    return;
  }
  loadingMessage.remove();

  const matchingFields = fields
    .map((field) => ({ field, score: scoreNameMatch([field.label, field.apiName], fieldTerm) }))
    .filter(({ score }) => score > 0)
    // Ties: shorter labels first (closer to what was typed), then alphabetical
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.field.label.length - b.field.label.length ||
        a.field.label.localeCompare(b.field.label),
    );

  if (fields.length === 0) {
    appendFieldSearchMessage(resultsContainer, `No fields found for ${targetObject.label}.`);
    return;
  }

  const summary = document.createElement("p");
  summary.classList.add("sf-field-search-summary");
  summary.textContent = `${targetObject.label}: ${matchingFields.length} of ${fields.length} fields`;
  resultsContainer.appendChild(summary);

  const objectBaseUrl = `${window.location.origin}/lightning/setup/ObjectManager/${objectSegment}`;
  for (const { field } of matchingFields) {
    const fieldItem = document.createElement("div");
    fieldItem.classList.add("sf-field-item");

    const fieldLink = document.createElement("a");
    fieldLink.href = `${objectBaseUrl}/FieldsAndRelationships/${encodeURIComponent(field.urlSegment)}/view`;
    fieldLink.textContent = field.label;
    fieldLink.title = `${field.label} (${field.apiName})`;
    fieldLink.classList.add("sf-field-link");
    fieldLink.addEventListener("click", (event) => navigateFromModal(event, fieldLink.href));
    fieldItem.appendChild(fieldLink);

    const fieldDetails = document.createElement("span");
    fieldDetails.classList.add("sf-field-details");
    fieldDetails.textContent = `${field.apiName} · ${field.dataType}`;
    fieldItem.appendChild(fieldDetails);

    resultsContainer.appendChild(fieldItem);
  }
}

/********* content/renderers.js **************/
async function renderTagCloud(containerElement, links, searchTerm = "") {
  const refreshContainer = containerElement.querySelector(".sf-tab-refresh-container");
  containerElement.innerHTML = "";
  if (refreshContainer) {
    containerElement.appendChild(refreshContainer);
  }
  const tagCloudContainer = document.createElement("div");
  tagCloudContainer.classList.add("sf-tag-cloud-container");
  containerElement.appendChild(tagCloudContainer);
  await getPinnedLinks();
  const sortedLinks = Object.entries(links)
    .sort(([, valA], [, valB]) => valA.href.localeCompare(valB.href))
    .sort(([, valA], [, valB]) => valA.label.localeCompare(valB.label))
    .sort(([, valA], [, valB]) => {
      return _pinnedLinks.includes(valB.href) - _pinnedLinks.includes(valA.href);
    });
  for (const [, value] of sortedLinks) {
    if (
      !searchTerm ||
      value.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      value.parentLabel?.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      const div = document.createElement("div");
      div.classList.add("sf-tag-cloud-item");
      div.classList.add((await isPinned(value.href)) ? "pinned" : "unpinned");
      const link = document.createElement("a");
      link.href = value.href;
      link.textContent = value.label;
      link.title = value.parentLabel || "";
      link.classList.add("sf-tag-cloud-tag");
      link.onclick = (e) => {
        e.preventDefault();
        window.location.href = link.href;
        const modal = document.getElementById(MODAL_ID);
        if (modal) cleanupModal(modal);
        return false;
      };
      div.appendChild(link);
      const pinBtn = document.createElement("button");
      pinBtn.textContent = (await isPinned(value.href)) ? "📍" : "📌";
      pinBtn.classList.add("sf-tag-cloud-pin-button");
      pinBtn.onclick = () => {
        togglePin(value.href);
      };
      div.appendChild(pinBtn);
      const parentLabel = document.createElement("span");
      parentLabel.textContent = value.parentLabel;
      parentLabel.classList.add("sf-tag-cloud-parent-label");
      div.appendChild(parentLabel);
      tagCloudContainer.appendChild(div);
    }
  }
  if (tagCloudContainer.children.length === 0 && searchTerm) {
    const noResults = document.createElement("p");
    noResults.textContent = "No matching links found.";
    tagCloudContainer.appendChild(noResults);
  } else if (Object.keys(links).length === 0 && !searchTerm) {
    const noResults = document.createElement("p");
    noResults.textContent = "No links found yet. Extraction might be needed (triple-click button).";
    tagCloudContainer.appendChild(noResults);
  }
}

async function renderObjectsCloud(containerElement, objects, searchTerm = "") {
  const refreshContainer = containerElement.querySelector(".sf-tab-refresh-container");
  containerElement.innerHTML = "";
  if (refreshContainer) {
    containerElement.appendChild(refreshContainer);
  }
  const objectsContainer = document.createElement("div");
  objectsContainer.classList.add("sf-objects-container");
  containerElement.appendChild(objectsContainer);
  await getPinnedObjects();
  if (Object.keys(objects).length === 0) {
    const extractMessage = document.createElement("div");
    extractMessage.classList.add("sf-empty-message");
    extractMessage.textContent =
      "No objects found. Navigate to Object Manager and double-click the button to extract objects.";
    objectsContainer.appendChild(extractMessage);
    return;
  }
  const sortedObjects = Object.entries(objects)
    .sort(([, valA], [, valB]) => valA.label.localeCompare(valB.label))
    .sort(([, valA], [, valB]) => {
      return _pinnedObjects.includes(valB.href) - _pinnedObjects.includes(valA.href);
    });
  for (const [, value] of sortedObjects) {
    if (!searchTerm || value.label.toLowerCase().includes(searchTerm.toLowerCase())) {
      const div = document.createElement("div");
      div.classList.add("sf-object-item");
      div.classList.add(_pinnedObjects.includes(value.href) ? "pinned" : "unpinned");

      const mainRow = document.createElement("div");
      mainRow.classList.add("sf-object-main-row");

      const link = document.createElement("a");
      link.href = value.href;
      link.textContent = value.label;
      link.classList.add("sf-object-link");
      link.onclick = (e) => {
        e.preventDefault();
        window.location.href = link.href;
        const modal = document.getElementById(MODAL_ID);
        if (modal) cleanupModal(modal);
        return false;
      };
      mainRow.appendChild(link);

      const pinBtn = document.createElement("button");
      pinBtn.textContent = _pinnedObjects.includes(value.href) ? "📍" : "📌";
      pinBtn.classList.add("sf-object-pin-button");
      pinBtn.onclick = () => toggleObjectPin(value.href);
      mainRow.appendChild(pinBtn);

      div.appendChild(mainRow);

      const quickLinksRow = document.createElement("div");
      quickLinksRow.classList.add("sf-object-quick-links");

      let baseUrl = value.href;
      baseUrl = baseUrl.replace(/\/Details\/view$/, "");
      baseUrl = baseUrl.replace(/\/view$/, "");
      baseUrl = baseUrl.replace(/\/view\//, "/");

      const quickLinks = [
        { label: "FIELDS", path: "/FieldsAndRelationships/view" },
        { label: "RULES", path: "/ValidationRules/view" },
        { label: "LAYOUTS", path: "/PageLayouts/view" },
        { label: "TYPES", path: "/RecordTypes/view" },
        { label: "PAGES", path: "/LightningPages/view" },
        { label: "BUTTONS", path: "/ButtonsLinksActions/view" },
        { label: "FIELDSETS", path: "/FieldSets/view" },
        { label: "COMPACT", path: "/CompactLayouts/view" },
      ];

      quickLinks.forEach((quickLink) => {
        const quickLinkElement = document.createElement("a");
        let constructedUrl = baseUrl + quickLink.path;
        constructedUrl = constructedUrl.replace(/\/view\/([^\/]+)\/view$/, "/$1/view");
        quickLinkElement.href = constructedUrl;
        quickLinkElement.textContent = quickLink.label;
        quickLinkElement.classList.add("sf-quick-link");
        quickLinkElement.onclick = (e) => {
          e.preventDefault();
          window.location.href = quickLinkElement.href;
          const modal = document.getElementById(MODAL_ID);
          if (modal) cleanupModal(modal);
        };
        quickLinksRow.appendChild(quickLinkElement);
      });

      div.appendChild(quickLinksRow);
      objectsContainer.appendChild(div);
    }
  }

  if (objectsContainer.children.length === 0 && searchTerm) {
    const noResults = document.createElement("p");
    noResults.textContent = "No matching objects found.";
    objectsContainer.appendChild(noResults);
  }
}

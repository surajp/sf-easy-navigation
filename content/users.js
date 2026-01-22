/********* content/users.js **************/
function showLoadingIndicator(containerElement) {
  if (!containerElement) return;
  containerElement.innerHTML = "";
  const loadingWrapper = document.createElement("div");
  loadingWrapper.classList.add("sf-loading-spinner");
  loadingWrapper.innerHTML = '<div class="sf-spinner"></div><p>Searching users...</p>';
  containerElement.appendChild(loadingWrapper);
}

async function fetchAndRenderLoginAsUsers(searchTerm, containerElement, tabContent, forceRefresh = false) {
  if (!containerElement) return;
  showLoadingIndicator(containerElement);
  try {
    let users;
    const shouldRefresh = forceRefresh || (await shouldRefreshUsersCache());
    if (shouldRefresh) {
      const apiResult = await searchUsers("");
      const usersCache = {
        records: apiResult.records.map((user) => ({
          Id: user.Id,
          Name: user.Name,
          Email: user.Email,
          Username: user.Username,
          LastLoginDate: user.LastLoginDate,
          IsActive: user.IsActive,
        })),
      };
      await saveUsersCache(usersCache, true);
      users = usersCache;
    } else {
      users = await retrieveOrCreateUsersCache();
    }
    if (searchTerm) {
      const sanitizedTerm = searchTerm.trim().toLowerCase();
      users.records = users.records.filter(
        (user) =>
          user.Name.toLowerCase().includes(sanitizedTerm) ||
          user.Username.toLowerCase().includes(sanitizedTerm) ||
          (user.Email && user.Email.toLowerCase().includes(sanitizedTerm)),
      );
    }
    if (!searchTerm) {
      const recentUsersList = await retrieveOrCreateRecentUsersCache();
      if (recentUsersList && recentUsersList.length > 0) {
        const recentUsersFromCache = users.records.filter((u) => recentUsersList.includes(u.Id));
        const recentIdsSet = new Set(recentUsersFromCache.map((u) => u.Id));
        const filteredRegularUsers = users.records.filter((u) => !recentIdsSet.has(u.Id));
        const recentUsersSorted = recentUsersFromCache.sort((a, b) => {
          return recentUsersList.indexOf(a.Id) - recentUsersList.indexOf(b.Id);
        });
        users.records = [...recentUsersSorted, ...filteredRegularUsers];
      }
    }
    await renderUserResults(containerElement, users, searchTerm);
    if (!searchTerm && tabContent) {
      tabContent.dataset.loaded = "true";
    }
  } catch (error) {
    containerElement.innerHTML = "";
    const errorDiv = document.createElement("p");
    errorDiv.classList.add("sf-error-message");
    errorDiv.textContent = error.message;
    containerElement.appendChild(errorDiv);
  }
}

async function renderUserResults(containerElement, users, searchTerm = "") {
  containerElement.innerHTML = "";
  const usersContainer = document.createElement("div");
  usersContainer.classList.add("sf-users-container");
  containerElement.appendChild(usersContainer);
  if (!users.records || users.records.length === 0) {
    const noResults = document.createElement("p");
    noResults.classList.add("sf-empty-message");
    noResults.textContent = searchTerm ? "No matching users found." : "No users found.";
    usersContainer.appendChild(noResults);
    return;
  }
  await retrieveOrCreateRecentUsersCache();
  const recentUsersList = _recentUsers || [];
  const recentUsersMap = new Map(recentUsersList.map((id, index) => [id, index]));
  const sortedUsers = [...users.records].sort((a, b) => {
    const aRecentIndex = recentUsersMap.has(a.Id) ? recentUsersMap.get(a.Id) : -1;
    const bRecentIndex = recentUsersMap.has(b.Id) ? recentUsersMap.get(b.Id) : -1;
    if (aRecentIndex !== -1 && bRecentIndex !== -1) {
      return aRecentIndex - bRecentIndex;
    }
    if (aRecentIndex !== -1) return -1;
    if (bRecentIndex !== -1) return 1;
    return a.Name.localeCompare(b.Name);
  });
  sortedUsers.forEach((user) => {
    const userRow = document.createElement("div");
    userRow.classList.add("sf-user-item");
    userRow.setAttribute("role", "button");
    userRow.tabIndex = 0;

    const userContent = document.createElement("div");
    userContent.classList.add("sf-user-content");

    const userName = document.createElement("div");
    userName.classList.add("sf-user-name");
    userName.textContent = user.Name;

    const userDetails = document.createElement("div");
    userDetails.classList.add("sf-user-details");
    userDetails.textContent = user.Email ? `${user.Username} - ${user.Email}` : user.Username;

    userContent.appendChild(userName);
    userContent.appendChild(userDetails);
    userRow.appendChild(userContent);

    const userActions = document.createElement("div");
    userActions.classList.add("sf-user-actions");

    const profileBtn = document.createElement("button");
    profileBtn.textContent = "👤";
    profileBtn.classList.add("sf-user-profile-button");
    profileBtn.setAttribute("aria-label", "View user profile");
    profileBtn.title = "View User Profile";
    profileBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const userDetailUrl = getUserDetailPageUrl(user.Id);
      window.location.href = userDetailUrl;
      const modal = document.getElementById(MODAL_ID);
      if (modal) cleanupModal(modal);
    });
    userActions.appendChild(profileBtn);
    userRow.appendChild(userActions);

    const handleLoginAs = async () => {
      try {
        await updateRecentUsers(user.Id);
        const loginAsUrl = await getLoginAsUrl(user.Id);
        window.location.href = loginAsUrl;
        const modal = document.getElementById(MODAL_ID);
        if (modal) cleanupModal(modal);
      } catch (error) {
        console.error("Error logging in as user:", error);
        alert("Failed to login as user: " + error.message);
      }
    };

    userRow.addEventListener("click", handleLoginAs);
    userRow.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleLoginAs();
      }
    });

    usersContainer.appendChild(userRow);
  });
}

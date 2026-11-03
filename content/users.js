/********* content/users.js **************/
function showLoadingIndicator(containerElement) {
  if (!containerElement) return;
  containerElement.innerHTML = "";
  const loadingWrapper = document.createElement("div");
  loadingWrapper.classList.add("sf-loading-spinner");
  loadingWrapper.innerHTML = '<div class="sf-spinner"></div><p>Searching users...</p>';
  containerElement.appendChild(loadingWrapper);
}

function showLoginAsError(containerElement, message) {
  if (!containerElement) return;
  let errorElement = containerElement.querySelector(".sf-error-message");
  if (!errorElement) {
    errorElement = document.createElement("p");
    errorElement.classList.add("sf-error-message");
    containerElement.prepend(errorElement);
  }
  errorElement.textContent = message;
}

function cancelPendingUserSearch() {
  if (userSearchAbortController) {
    userSearchAbortController.abort();
    userSearchAbortController = null;
  }
}

// Without a search term: users you've logged in as recently, then the most recently active users
async function fetchDefaultLoginAsUsers(signal) {
  const recentUserIds = (await retrieveOrCreateRecentUsersCache()).slice(0, MAX_RECENT_USERS);
  const [recentUsers, recentlyActiveUsers] = await Promise.all([
    getUsersByIds(recentUserIds, signal),
    searchUsers("", signal),
  ]);
  const seenIds = new Set();
  const records = [...recentUsers.records, ...recentlyActiveUsers.records].filter((user) => {
    if (seenIds.has(user.Id)) return false;
    seenIds.add(user.Id);
    return true;
  });
  return { records };
}

// Users are queried live on every search and never stored
async function fetchAndRenderLoginAsUsers(searchTerm, containerElement) {
  if (!containerElement) return;
  // Only the newest search may render; older in-flight requests are cancelled
  cancelPendingUserSearch();
  const abortController = new AbortController();
  userSearchAbortController = abortController;
  showLoadingIndicator(containerElement);
  try {
    const users = searchTerm
      ? await searchUsers(searchTerm, abortController.signal)
      : await fetchDefaultLoginAsUsers(abortController.signal);
    if (abortController.signal.aborted) return;
    // renderUserResults handles ordering (recent logins first, then by name)
    await renderUserResults(containerElement, users, searchTerm);
  } catch (error) {
    if (error.name === "AbortError") return;
    containerElement.innerHTML = "";
    const errorDiv = document.createElement("p");
    errorDiv.classList.add("sf-error-message");
    errorDiv.textContent = error.message;
    containerElement.appendChild(errorDiv);
  } finally {
    if (userSearchAbortController === abortController) {
      userSearchAbortController = null;
    }
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
        showLoginAsError(containerElement, `Failed to login as user: ${error.message}`);
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

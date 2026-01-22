/********* content/state.js **************/
let sessionIdCache = null;
let orgIdCache = null;
let currentButton;
let buttonEventListenersAttached = false;
let clickCount = 0;
let clickTimer;
let hoverTimer = null;
let tabHoverTimer = null;
let searchDebounceTimer = null;
let isExtracting = false;
let _pinnedLinks = [];
let _pinnedObjects = [];
let _recentUsers = [];

function delay(ms) {
  return new Promise((resolve) => {
    const start = performance.now();
    function check(timestamp) {
      if (timestamp - start >= ms) {
        resolve();
      } else {
        requestAnimationFrame(check);
      }
    }
    requestAnimationFrame(check);
  });
}

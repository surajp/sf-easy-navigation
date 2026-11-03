/********* content/state.js **************/
let sessionIdCache = null;
let orgIdCache = null;
let currentButton;
let buttonEventListenersAttached = false;
let hoverTimer = null;
let tabHoverTimer = null;
let searchDebounceTimer = null;
let userSearchAbortController = null;
// Field search: { objectSegment, fieldsPromise, abortController } for the open modal only, never stored
let _modalFieldList = null;
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

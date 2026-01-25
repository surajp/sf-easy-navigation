/********* content/constants.js **************/
console.log("Salesforce Go Home/Setup Extension: Content script loaded.");

function getDomain() {
  const url = new URL(window.location.href);
  return url.hostname.split(".")[0];
}

const BUTTON_ID = "sf-go-home-setup-button-ext";
const MODAL_ID = "sf-setup-tag-cloud-modal-ext";
const SETUP_PATH_REGEX = /\/lightning\/setup/;
const HOME_PATH = "/lightning/page/home";
const SETUP_HOME_PATH = "/lightning/setup/SetupOneHome/home";
const OBJECT_MANAGER_PATH = "/lightning/setup/ObjectManager/home";
const KEY_BASE = `sf-setup-links-${getDomain()}`;
const SALESFORCE_API_VERSION = "65.0";
const CACHE_EXPIRY_DAYS = 60;
const USER_CACHE_EXPIRY_DAYS = 30;
const BUTTON_CLICK_DELAY_MS = 300;

// --- Hover Configuration ---
const BUTTON_HOVER_DELAY_MS = 1000;
const TAB_HOVER_DELAY_MS = 50;

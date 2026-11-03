/********* content/constants.js **************/
console.log("Salesforce Go Home/Setup Extension: Content script loaded.");

function getDomain() {
  const url = new URL(window.location.href);
  return url.hostname.split(".")[0];
}

// --- Org environment ---
// Enhanced domains put the org type in the hostname (acme--uat.sandbox..., x.develop..., x.scratch...);
// production hosts have none of these segments. "--" in the first label is the sandbox naming rule.
const NON_PRODUCTION_HOST_SEGMENTS = ["sandbox", "develop", "scratch", "patch", "trailblaze", "demo", "free"];

function isProductionOrg() {
  const hostSegments = window.location.hostname.split(".");
  if (hostSegments[0].includes("--")) return false;
  return !hostSegments.slice(1).some((segment) => NON_PRODUCTION_HOST_SEGMENTS.includes(segment));
}

const IS_PRODUCTION_ORG = isProductionOrg();

const BUTTON_ID = "sf-go-home-setup-button-ext";
const MODAL_ID = "sf-setup-tag-cloud-modal-ext";
const SETUP_PATH_REGEX = /\/lightning\/setup/;
const HOME_PATH = "/lightning/page/home";
const SETUP_HOME_PATH = "/lightning/setup/SetupOneHome/home";
const KEY_BASE = `sf-setup-links-${getDomain()}`;
const SALESFORCE_API_VERSION = "65.0";
const CACHE_EXPIRY_DAYS = 60;
const USER_CACHE_EXPIRY_DAYS = 30;

// --- Hover Configuration ---
const BUTTON_HOVER_DELAY_MS = 1000;
const TAB_HOVER_DELAY_MS = 50;

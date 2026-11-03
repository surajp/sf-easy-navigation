/********* content/init.js **************/
// Polling covers both SPA navigation (button icon/title depend on the URL)
// and re-attaching the button if Salesforce removes it from the page
updateButtonState();
setInterval(updateButtonState, 1000);

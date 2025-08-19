// popup.js
document.getElementById("injectBtn").addEventListener("click", async () => {
  // Get the currently active tab which returns an object of the current tab with different paramaters. we want ID
  let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  let tab = tabs[0]; 
  
  // Inject content.js into the current tab
  //chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }) tells Chrome to run content.js in the context of that webpage.This requires the "scripting" permission in your manifest and (for most pages) a matching "host_permissions" entry (we set <all_urls> so it works anywhere during dev).
  // After this runs, whatever code is in content.js will execute inside the page (we’ll write that next to actually draw your widget).
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"]
  });

  // You could show a quick confirmation later
  console.log("TrustFeed widget injected into tab:", tab.url);
});
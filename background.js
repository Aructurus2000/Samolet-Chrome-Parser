chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "filterByApartment") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: filterByApartment,
        args: [message.apartmentNumber],
      });
    });
  } else if (message.action === "openPopup") {
    // Открываем попап программно
    chrome.action.openPopup();
  }
});

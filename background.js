// Обработчик сообщений
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Получено сообщение в background:", message);

  if (message.action === "openPopup") {
    chrome.action.openPopup();
  } else if (message.action === "openNewTab") {
    console.log("Открываем новую вкладку:", message.url);
    chrome.tabs.create({ url: message.url }, (tab) => {
      console.log("Новая вкладка создана:", tab);
    });
  }
});

// Add message listener for opening new tabs
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openNewTab") {
    chrome.tabs.create({ url: request.url });
  }
});

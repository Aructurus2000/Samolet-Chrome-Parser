document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("apartmentNumber");
  const button = document.getElementById("filterButton");
  const status = document.getElementById("status");

  // Восстанавливаем последний поиск
  chrome.storage.local.get(["lastSearch"], (result) => {
    if (result.lastSearch) {
      input.value = result.lastSearch;
    }
  });

  // Обработка нажатия Enter
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      button.click();
    }
  });

  button.addEventListener("click", async () => {
    const apartmentNumber = input.value.trim();

    if (!apartmentNumber) {
      status.textContent = "Пожалуйста, введите номер квартиры";
      status.style.color = "#f44336";
      return;
    }

    // Сохраняем последний поиск
    chrome.storage.local.set({ lastSearch: apartmentNumber });

    // Получаем активную вкладку
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab.url.includes("control.samoletgroup.ru")) {
        status.textContent = "Откройте сайт control.samoletgroup.ru";
        status.style.color = "#f44336";
        return;
      }

      button.disabled = true;
      status.textContent = "Поиск...";
      status.style.color = "#4CAF50";

      // Отправляем сообщение в content script
      await chrome.tabs.sendMessage(tab.id, {
        action: "filterByApartment",
        apartmentNumber,
      });

      // Закрываем popup
      window.close();
    } catch (error) {
      console.error("Ошибка:", error);
      status.textContent = "Произошла ошибка. Попробуйте обновить страницу.";
      status.style.color = "#f44336";
      button.disabled = false;
    }
  });
});

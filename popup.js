document.addEventListener("DOMContentLoaded", () => {
  // DOM элементы
  const apartmentInput = document.getElementById("apartmentNumber");
  const filterButton = document.getElementById("filterButton");
  const gotoButton = document.getElementById("gotoButton");
  const statusDiv = document.getElementById("status");

  // Восстановление последнего поиска
  chrome.storage.local.get(["lastSearch"], (result) => {
    if (result.lastSearch) {
      apartmentInput.value = result.lastSearch;
    }
  });

  // Вспомогательные функции
  function updateStatus(message, isError = false) {
    statusDiv.textContent = message;
    statusDiv.style.color = isError ? "#f44336" : "#666";
  }

  function disableButtons() {
    filterButton.disabled = true;
    gotoButton.disabled = true;
  }

  function enableButtons() {
    filterButton.disabled = false;
    gotoButton.disabled = false;
  }

  // Основная функция поиска
  async function handleSearch(mode) {
    const apartmentNumber = apartmentInput.value.trim();
    if (!apartmentNumber) {
      updateStatus("Введите номер квартиры", true);
      return;
    }

    // Сохранение поиска
    chrome.storage.local.set({ lastSearch: apartmentNumber });

    disableButtons();
    updateStatus("Поиск...");

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab.url.includes("control.samoletgroup.ru")) {
        updateStatus("Откройте сайт control.samoletgroup.ru", true);
        enableButtons();
        return;
      }

      await chrome.tabs.sendMessage(tab.id, {
        action: "filterByApartment",
        apartmentNumber,
        mode,
      });

      // Закрываем popup после успешного поиска
      window.close();
    } catch (error) {
      console.error("Error:", error);
      updateStatus("Ошибка при поиске", true);
      enableButtons();
    }
  }

  // Обработчики событий
  filterButton.addEventListener("click", () => handleSearch("search"));
  gotoButton.addEventListener("click", () => handleSearch("goto"));

  apartmentInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleSearch("search");
    }
  });
});

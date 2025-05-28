document.addEventListener("DOMContentLoaded", () => {
  // DOM элементы
  const apartmentInput = document.getElementById("apartmentNumber");
  const filterButton = document.getElementById("filterButton");
  const gotoButton = document.getElementById("gotoButton");
  const statusDiv = document.getElementById("status");
  const multipleSearchButton = document.getElementById("multipleSearchButton");
  const multipleSearchModal = document.getElementById("multipleSearchModal");
  const closeModal = document.querySelector(".close");
  const multipleApartments = document.getElementById("multipleApartments");
  const searchMultipleButton = document.getElementById("searchMultipleButton");

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
    multipleSearchButton.disabled = true;
  }

  function enableButtons() {
    filterButton.disabled = false;
    gotoButton.disabled = false;
    multipleSearchButton.disabled = false;
  }

  // Modal functions
  function openModal() {
    multipleSearchModal.style.display = "block";
  }

  function closeModalWindow() {
    multipleSearchModal.style.display = "none";
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

  // Multiple search function
  async function handleMultipleSearch() {
    const apartmentNumbers = multipleApartments.value
      .split(",")
      .map((num) => num.trim())
      .filter((num) => num !== "");

    if (apartmentNumbers.length === 0) {
      updateStatus("Введите хотя бы один номер квартиры", true);
      return;
    }

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

      // Send message to content script to handle multiple apartments
      await chrome.tabs.sendMessage(tab.id, {
        action: "filterMultipleApartments",
        apartmentNumbers,
      });

      // Close modal and popup
      closeModalWindow();
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
  multipleSearchButton.addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab.url.includes("control.samoletgroup.ru")) {
        updateStatus("Откройте сайт control.samoletgroup.ru", true);
        return;
      }

      await chrome.tabs.sendMessage(tab.id, {
        action: "showMultipleSearchModal",
      });

      // Закрываем popup после отправки сообщения
      window.close();
    } catch (error) {
      console.error("Error:", error);
      updateStatus("Ошибка при открытии окна поиска", true);
    }
  });
  closeModal.addEventListener("click", closeModalWindow);
  searchMultipleButton.addEventListener("click", handleMultipleSearch);

  apartmentInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleSearch("search");
    }
  });

  // Close modal when clicking outside
  window.addEventListener("click", (e) => {
    if (e.target === multipleSearchModal) {
      closeModalWindow();
    }
  });
});

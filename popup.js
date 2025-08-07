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
  const lastInputDiv = document.getElementById("lastInput");

  // При загрузке показываем последний ввод в отдельном блоке с кнопкой 'Повторить'
  function renderLastInput(value) {
    if (value) {
      lastInputDiv.innerHTML = `<span style=\"font-size:11.5pt;font-weight:normal;\">Последний ввод:</span> <span class=\"last-input-value\" style=\"font-size:11.5pt;font-weight:bold;\">${value}</span> <button id=\"repeatLastInput\" style=\"position:absolute;top:0;right:0;height:100%;border-radius:0 6px 6px 0;padding:0 16px;font-size:12px;background:#1976d2;color:#fff;border:none;cursor:pointer;\">Повторить</button>`;
      document.getElementById("repeatLastInput").onclick = function () {
        apartmentInput.value = value;
        apartmentInput.focus();
      };
    } else {
      lastInputDiv.textContent = "";
    }
  }

  chrome.storage.local.get(["lastSearch"], (result) => {
    renderLastInput(result.lastSearch);
  });

  function saveAndShowLastInput(value) {
    chrome.storage.local.set({ lastSearch: value });
    renderLastInput(value);
  }

  // Вспомогательные функции
  function updateStatus(message, isError = false) {
    statusDiv.textContent = message;
    statusDiv.style.color = isError ? "#f44336" : "#666";
  }

  function disableButtons() {
    filterButton.disabled = true;
  }

  function enableButtons() {
    filterButton.disabled = false;
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
  filterButton.addEventListener("click", async () => {
    const input = apartmentInput.value.trim();
    if (!input) {
      updateStatus("Введите номер квартиры", true);
      return;
    }
    const apartmentNumbers = input
      .split(",")
      .map((num) => num.trim())
      .filter((num) => num !== "");
    saveAndShowLastInput(input);
    if (apartmentNumbers.length === 1) {
      // Обычный поиск
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
          apartmentNumber: apartmentNumbers[0],
          mode: "search",
        });
        window.close();
      } catch (error) {
        console.error("Error:", error);
        updateStatus("Ошибка при поиске", true);
        enableButtons();
      }
    } else if (apartmentNumbers.length > 1) {
      // Множественный поиск
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
          action: "filterMultipleApartments",
          apartmentNumbers,
        });
        window.close();
      } catch (error) {
        console.error("Error:", error);
        updateStatus("Ошибка при поиске", true);
        enableButtons();
      }
    }
  });

  // Обработчик для кнопки 'Переход к квартире'
  gotoButton.addEventListener("click", async () => {
    const input = apartmentInput.value.trim();
    if (!input) {
      updateStatus("Введите номер квартиры", true);
      return;
    }
    const apartmentNumbers = input
      .split(",")
      .map((num) => num.trim())
      .filter((num) => num !== "");
    saveAndShowLastInput(input);
    if (apartmentNumbers.length !== 1) {
      updateStatus("Для перехода укажите только один номер квартиры", true);
      return;
    }
    disableButtons();
    updateStatus("Переход...");
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
        apartmentNumber: apartmentNumbers[0],
        mode: "goto",
      });
      window.close();
    } catch (error) {
      console.error("Error:", error);
      updateStatus("Ошибка при переходе", true);
      enableButtons();
    }
  });

  closeModal.addEventListener("click", closeModalWindow);
  searchMultipleButton.addEventListener("click", handleMultipleSearch);

  apartmentInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      filterButton.click();
    }
  });

  // Close modal when clicking outside
  window.addEventListener("click", (e) => {
    if (e.target === multipleSearchModal) {
      closeModalWindow();
    }
  });
});

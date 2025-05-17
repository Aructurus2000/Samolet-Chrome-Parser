let isSearching = false;
let foundApartment = false;
let currentSearchIndicator = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function removeExistingIndicator() {
  const existingIndicator = document.getElementById(
    "apartment-search-indicator"
  );
  if (existingIndicator) {
    existingIndicator.remove();
  }
}

function createSearchIndicator() {
  removeExistingIndicator();

  const searchIndicator = document.createElement("div");
  searchIndicator.id = "apartment-search-indicator";
  searchIndicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #4CAF50;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    z-index: 9999;
    font-family: Arial, sans-serif;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
    max-width: 300px;
    min-width: 200px;
  `;

  document.body.appendChild(searchIndicator);
  currentSearchIndicator = searchIndicator;
  return searchIndicator;
}

function updateSearchIndicator(
  message,
  isError = false,
  isSuccess = false,
  showButton = false
) {
  if (!currentSearchIndicator) return;

  currentSearchIndicator.style.backgroundColor = isError
    ? "#f44336"
    : isSuccess
    ? "#4CAF50"
    : "#2196F3";

  // Очищаем содержимое индикатора
  currentSearchIndicator.innerHTML = "";

  // Добавляем текст сообщения
  const messageDiv = document.createElement("div");
  messageDiv.style.marginBottom = showButton ? "10px" : "0";
  messageDiv.textContent = message;
  currentSearchIndicator.appendChild(messageDiv);

  // Добавляем кнопку "Искать снова", если нужно
  if (showButton) {
    const searchAgainButton = document.createElement("button");
    searchAgainButton.textContent = "Искать другой номер";
    searchAgainButton.style.cssText = `
      background: white;
      color: ${isError ? "#f44336" : "#4CAF50"};
      border: none;
      padding: 5px 10px;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 8px;
      width: 100%;
      font-weight: bold;
      transition: background-color 0.3s;
    `;
    searchAgainButton.addEventListener("mouseover", () => {
      searchAgainButton.style.backgroundColor = "#f5f5f5";
    });
    searchAgainButton.addEventListener("mouseout", () => {
      searchAgainButton.style.backgroundColor = "white";
    });
    searchAgainButton.addEventListener("click", () => {
      removeExistingIndicator();
      chrome.runtime.sendMessage({ action: "openPopup" });
    });
    currentSearchIndicator.appendChild(searchAgainButton);
  }
}

async function goToPage(pageNumber) {
  const pagination = document.querySelector(".ant-pagination");
  if (!pagination) return false;

  const pageButton = pagination.querySelector(
    `.ant-pagination-item-${pageNumber}`
  );
  if (pageButton) {
    pageButton.click();
    await sleep(1500); // Ждем загрузку страницы
    return true;
  }
  return false;
}

async function getCurrentPageNumber() {
  const activePage = document.querySelector(".ant-pagination-item-active");
  return activePage ? parseInt(activePage.textContent) : 1;
}

async function getTotalPages() {
  const pagination = document.querySelector(".ant-pagination");
  if (!pagination) return 1;

  const pages = pagination.querySelectorAll(".ant-pagination-item");
  return pages.length > 0 ? pages.length : 1;
}

async function searchOnCurrentPage(apartmentNumber) {
  const rows = document.querySelectorAll("tbody tr");
  let found = false;

  rows.forEach((row) => {
    const cells = row.getElementsByTagName("td");
    const kvCell = cells[7];
    if (
      kvCell &&
      String(kvCell.textContent).trim() === String(apartmentNumber).trim()
    ) {
      found = true;
      row.style.cssText = `
        background-color: #4CAF50 !important;
        color: white !important;
      `;
      row.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      row.style.backgroundColor = "";
      row.style.color = "";
    }
  });

  return found;
}

async function filterByApartment(apartmentNumber) {
  if (isSearching) return;
  isSearching = true;
  foundApartment = false;

  const searchIndicator = createSearchIndicator();
  updateSearchIndicator("Подготовка к поиску...");

  try {
    const totalPages = await getTotalPages();
    const startPage = 1;

    for (let pageNum = startPage; pageNum <= totalPages; pageNum++) {
      updateSearchIndicator(`Поиск на странице ${pageNum} из ${totalPages}...`);

      const pageChanged = await goToPage(pageNum);
      if (!pageChanged) {
        updateSearchIndicator("Ошибка навигации по страницам", true);
        break;
      }

      foundApartment = await searchOnCurrentPage(apartmentNumber);

      if (foundApartment) {
        updateSearchIndicator(
          `Квартира ${apartmentNumber} найдена на странице ${pageNum}!`,
          false,
          true,
          true
        );
        break;
      }

      await sleep(500);
    }

    if (!foundApartment) {
      updateSearchIndicator(
        `Квартира ${apartmentNumber} не найдена. Попробуйте поискать другой номер.`,
        true,
        false,
        true
      );
    }
  } catch (error) {
    console.error("Ошибка при поиске:", error);
    updateSearchIndicator("Произошла ошибка при поиске", true, false, true);
  } finally {
    isSearching = false;

    // Удаляем индикатор через 7 секунд только если квартира не найдена
    if (!foundApartment) {
      setTimeout(() => {
        removeExistingIndicator();
      }, 7000);
    }
  }
}

// Получаем сообщение от фонового скрипта
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "filterByApartment") {
    filterByApartment(message.apartmentNumber);
  }
});

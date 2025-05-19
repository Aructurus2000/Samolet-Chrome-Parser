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

  // Находим последний элемент пагинации, который содержит общее количество страниц
  const lastPageElement = pagination.querySelector(
      ".ant-pagination-item:last-child"
  );
  if (lastPageElement) {
    return parseInt(lastPageElement.textContent);
  }

  // Если не нашли последний элемент, пробуем найти через список всех страниц
  const pages = pagination.querySelectorAll(".ant-pagination-item");
  if (pages.length > 0) {
    // Находим максимальный номер страницы
    let maxPage = 1;
    pages.forEach((page) => {
      const pageNum = parseInt(page.textContent);
      if (!isNaN(pageNum) && pageNum > maxPage) {
        maxPage = pageNum;
      }
    });
    return maxPage;
  }

  return 1;
}

function createSearchButton() {
  const buttonContainer = document.createElement("div");
  buttonContainer.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 9999;
  `;

  const searchButton = document.createElement("button");
  searchButton.id = "apartment-search-button";
  searchButton.textContent = "Поиск квартиры";
  searchButton.style.cssText = `
    background: #4CAF50;
    color: white;
    padding: 10px 15px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: background-color 0.3s;
  `;

  const gotoButton = document.createElement("button");
  gotoButton.id = "apartment-goto-button";
  gotoButton.textContent = "Переход к квартире";
  gotoButton.style.cssText = `
    background: #2196F3;
    color: white;
    padding: 10px 15px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: background-color 0.3s;
  `;

  searchButton.addEventListener("mouseover", () => {
    searchButton.style.backgroundColor = "#45a049";
  });

  searchButton.addEventListener("mouseout", () => {
    searchButton.style.backgroundColor = "#4CAF50";
  });

  gotoButton.addEventListener("mouseover", () => {
    gotoButton.style.backgroundColor = "#1976D2";
  });

  gotoButton.addEventListener("mouseout", () => {
    gotoButton.style.backgroundColor = "#2196F3";
  });

  searchButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "openPopup", mode: "search" });
  });

  gotoButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "openPopup", mode: "goto" });
  });

  buttonContainer.appendChild(searchButton);
  buttonContainer.appendChild(gotoButton);
  document.body.appendChild(buttonContainer);
}

async function searchOnCurrentPage(apartmentNumber, shouldNavigate = false) {
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
        cursor: pointer !important;
      `;

      if (shouldNavigate) {
        // Автоматически кликаем по строке для перехода
        const links = row.querySelectorAll("a");
        if (links.length > 0) {
          const detailLink = links[0];
          console.log("Найдена ссылка:", detailLink.href);
          detailLink.click();
          if (!detailLink.href.includes(window.location.href)) {
            window.location.href = detailLink.href;
          }
        } else {
          const firstCell = cells[0];
          if (firstCell) {
            const cellLink = firstCell.querySelector("a");
            if (cellLink) {
              console.log("Найдена ссылка в первой ячейке:", cellLink.href);
              cellLink.click();
              if (!cellLink.href.includes(window.location.href)) {
                window.location.href = cellLink.href;
              }
            }
          }
        }
      }

      row.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      row.style.backgroundColor = "";
      row.style.color = "";
      row.style.cursor = "";
    }
  });

  return found;
}

async function filterByApartment(apartmentNumber, shouldNavigate = false) {
  if (isSearching) return;
  isSearching = true;
  foundApartment = false;

  const searchIndicator = createSearchIndicator();
  updateSearchIndicator("Подготовка к поиску...");

  try {
    const totalPages = await getTotalPages();
    const currentPage = await getCurrentPageNumber();
    const checkedPages = new Set();

    // First search on current page
    updateSearchIndicator(`Поиск на текущей странице ${currentPage}...`);
    foundApartment = await searchOnCurrentPage(apartmentNumber, shouldNavigate);
    checkedPages.add(currentPage);

    if (foundApartment) {
      updateSearchIndicator(
          `Квартира ${apartmentNumber} найдена на странице ${currentPage}!`,
          false,
          true,
          !shouldNavigate
      );
      return;
    }

    // Then search from page 1 to last page, skipping already checked pages
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (checkedPages.has(pageNum)) continue;

      updateSearchIndicator(`Поиск на странице ${pageNum} из ${totalPages}...`);

      const pageChanged = await goToPage(pageNum);
      if (!pageChanged) {
        updateSearchIndicator("Ошибка навигации по страницам", true);
        break;
      }

      foundApartment = await searchOnCurrentPage(
          apartmentNumber,
          shouldNavigate
      );
      checkedPages.add(pageNum);

      if (foundApartment) {
        updateSearchIndicator(
            `Квартира ${apartmentNumber} найдена на странице ${pageNum}!`,
            false,
            true,
            !shouldNavigate
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

// Добавляем создание кнопки поиска при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
  createSearchButton();
});

// Получаем сообщение от фонового скрипта
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "filterByApartment") {
    filterByApartment(message.apartmentNumber, message.mode === "goto");
  }
});

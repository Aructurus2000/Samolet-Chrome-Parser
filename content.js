// Глобальные переменные
let isSearching = false;
let foundApartment = false;
let currentSearchIndicator = null;

// Вспомогательные функции
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

  currentSearchIndicator.innerHTML = "";

  const messageDiv = document.createElement("div");
  messageDiv.style.marginBottom = showButton ? "10px" : "0";
  messageDiv.textContent = message;
  currentSearchIndicator.appendChild(messageDiv);

  if (showButton) {
    const searchAgainButton = document.createElement("button");
    searchAgainButton.textContent = "Искать другой номер";
    searchAgainButton.addEventListener("click", () => {
      removeExistingIndicator();
      chrome.runtime.sendMessage({ action: "openPopup" });
    });
    currentSearchIndicator.appendChild(searchAgainButton);
  }
}

// Функции навигации
async function goToPage(pageNumber) {
  const pagination = document.querySelector(".ant-pagination");
  if (!pagination) return false;

  const pageButton = pagination.querySelector(
    `.ant-pagination-item-${pageNumber}`
  );
  if (pageButton) {
    pageButton.click();
    await sleep(1500);
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

  const lastPageElement = pagination.querySelector(
    ".ant-pagination-item:last-child"
  );
  if (lastPageElement) {
    return parseInt(lastPageElement.textContent);
  }

  const pages = pagination.querySelectorAll(".ant-pagination-item");
  if (pages.length > 0) {
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

// Основные функции поиска
async function searchOnCurrentPage(apartmentNumber, shouldNavigate = false) {
  const rows = document.querySelectorAll("tbody tr");
  let found = false;
  let foundRow = null;

  rows.forEach((row) => {
    const cells = row.getElementsByTagName("td");
    const kvCell = cells[7];
    if (
      kvCell &&
      String(kvCell.textContent).trim() === String(apartmentNumber).trim()
    ) {
      found = true;
      foundRow = row;
      row.classList.add("found-apartment-row");
      row.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      row.classList.remove("found-apartment-row");
    }
  });

  if (found && shouldNavigate && foundRow) {
    try {
      foundRow.addEventListener("click", function () {
        const links = foundRow.querySelectorAll("a");
        if (links.length > 0) {
          const detailLink = links[0];
          console.log("Найдена ссылка:", detailLink.href);
          detailLink.click();
        } else {
          const firstCell = foundRow.getElementsByTagName("td")[0];
          if (firstCell) {
            const cellLink = firstCell.querySelector("a");
            if (cellLink) {
              console.log("Найдена ссылка в первой ячейке:", cellLink.href);
              cellLink.click();
            }
          }
        }
      });

      foundRow.click();
    } catch (error) {
      console.error("Ошибка при переходе:", error);
    }
  }

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

    if (!foundApartment) {
      setTimeout(() => {
        removeExistingIndicator();
      }, 7000);
    }
  }
}

// Обработчики сообщений
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "filterByApartment") {
    filterByApartment(message.apartmentNumber, message.mode === "goto");
  }
});

// Глобальные переменные
let isSearching = false;
let foundApartment = false;
let currentSearchIndicator = null;

// Глобальный объект для хранения соответствия квартира -> дефект
const defectMap = {};

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
  // Не удаляем существующий индикатор, а обновляем его
  let searchIndicator = document.getElementById("apartment-search-indicator");

  if (!searchIndicator) {
    searchIndicator = document.createElement("div");
    searchIndicator.id = "apartment-search-indicator";
    searchIndicator.style.cssText = `
    position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px;
      border-radius: 8px;
      z-index: 1000;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    color: white;
    font-family: Arial, sans-serif;
      max-width: 400px;
    transition: all 0.3s ease;
      backdrop-filter: blur(5px);
  `;
    document.body.appendChild(searchIndicator);
  }

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
  messageDiv.style.paddingRight = "20px";
  messageDiv.textContent = message;
  currentSearchIndicator.appendChild(messageDiv);

  const closeButton = document.createElement("button");
  closeButton.innerHTML = "&times;";
  closeButton.style.cssText = `
    position: absolute;
    top: 5px;
    right: 5px;
    width: 20px;
    height: 20px;
    border: none;
    background: none;
    color: white;
    font-size: 16px;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s;
    padding: 0;
    line-height: 1;
  `;
  closeButton.onmouseover = () => (closeButton.style.opacity = "1");
  closeButton.onmouseout = () => (closeButton.style.opacity = "0.7");
  closeButton.onclick = () => removeExistingIndicator();
  currentSearchIndicator.appendChild(closeButton);

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

// Функции для модального окна
function createModal() {
  const modal = document.createElement("div");
  modal.id = "apartment-search-modal";
  modal.style.cssText = `
    display: none;
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.4);
    backdrop-filter: blur(3px);
  `;

  const modalContent = document.createElement("div");
  modalContent.style.cssText = `
    background-color: rgba(254, 254, 254, 0.95);
    margin: 15% auto;
    padding: 20px;
    border: 1px solid #888;
    width: 80%;
    max-width: 500px;
    border-radius: 8px;
    position: relative;
    backdrop-filter: blur(5px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  `;

  const closeButton = document.createElement("span");
  closeButton.innerHTML = "&times;";
  closeButton.style.cssText = `
    color: #aaa;
    float: right;
    font-size: 28px;
    font-weight: bold;
    cursor: pointer;
  `;
  closeButton.onclick = () => (modal.style.display = "none");

  const title = document.createElement("h3");
  title.textContent = "Введите номера квартир";
  title.style.marginBottom = "15px";

  const description = document.createElement("p");
  description.textContent = "Введите номера квартир через запятую:";
  description.style.marginBottom = "10px";

  const textarea = document.createElement("textarea");
  textarea.id = "multipleApartments";
  textarea.placeholder = "Например: 101, 102, 103";
  textarea.style.cssText = `
    width: 100%;
    height: 100px;
    margin: 10px 0;
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    resize: vertical;
  `;

  const searchButton = document.createElement("button");
  searchButton.textContent = "Начать поиск";
  searchButton.style.cssText = `
    width: 100%;
    padding: 10px;
    background-color: #4caf50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    margin-top: 10px;
  `;
  searchButton.onclick = () => {
    const input = textarea.value.trim();
    console.log("Введенный текст:", input);

    if (!input) {
      alert("Введите номера квартир");
      return;
    }

    // Разбиваем строку на номера, очищаем от пробелов и сортируем
    const apartmentNumbers = input
      .split(",")
      .map((num) => num.trim())
      .filter((num) => num !== "")
      .sort((a, b) => parseInt(a) - parseInt(b));

    console.log(
      "Обработанные и отсортированные номера квартир:",
      apartmentNumbers
    );

    if (apartmentNumbers.length === 0) {
      alert("Введите хотя бы один номер квартиры");
      return;
    }

    modal.style.display = "none";
    handleMultipleApartments(apartmentNumbers);
  };

  modalContent.appendChild(closeButton);
  modalContent.appendChild(title);
  modalContent.appendChild(description);
  modalContent.appendChild(textarea);
  modalContent.appendChild(searchButton);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  return modal;
}

let modalInstance = null;

// Обновляем обработчик сообщений
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "showMultipleSearchModal") {
    if (!modalInstance) {
      modalInstance = createModal();
    }
    modalInstance.style.display = "block";
  } else if (request.action === "filterByApartment") {
    filterByApartment(request.apartmentNumber, request.mode === "goto");
  } else if (request.action === "filterMultipleApartments") {
    (async () => {
      try {
        await handleMultipleApartments(request.apartmentNumbers);
      } catch (e) {
        console.error("Ошибка в handleMultipleApartments:", e);
      }
    })();
  }
});

// Функция для создания и обновления индикатора
function createOrUpdateIndicator(message, type = "info") {
  let indicator = document.querySelector(".apartment-search-indicator");

  if (!indicator) {
    indicator = document.createElement("div");
    indicator.className = "apartment-search-indicator";
    document.body.appendChild(indicator);

    // Добавляем стили для индикатора
    const style = document.createElement("style");
    style.textContent = `
      .apartment-search-indicator {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px;
        border-radius: 8px;
        z-index: 1000;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        color: white;
        font-family: Arial, sans-serif;
        max-width: 400px;
        transition: all 0.3s ease;
      }
      .apartment-search-indicator .close-button {
        position: absolute;
        top: 5px;
        right: 5px;
        width: 20px;
        height: 20px;
        border: none;
        background: none;
        color: white;
        font-size: 16px;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s;
      }
      .apartment-search-indicator .close-button:hover {
        opacity: 1;
      }
      .apartment-search-indicator.info {
        background-color: #2196F3;
      }
      .apartment-search-indicator.success {
        background-color: #4CAF50;
      }
      .apartment-search-indicator.error {
        background-color: #f44336;
      }
      .apartment-search-indicator .title {
        font-weight: bold;
        margin-bottom: 5px;
        padding-right: 20px;
      }
      .apartment-search-indicator .details {
        font-size: 0.9em;
        opacity: 0.9;
      }
      .apartment-search-indicator .progress {
        margin-top: 5px;
        font-size: 0.8em;
      }
    `;
    document.head.appendChild(style);
  }

  // Обновляем класс и содержимое индикатора
  indicator.className = `apartment-search-indicator ${type}`;
  indicator.innerHTML = `
    <button class="close-button">&times;</button>
    ${message}
  `;

  // Добавляем обработчик для кнопки закрытия
  const closeButton = indicator.querySelector(".close-button");
  closeButton.addEventListener("click", () => {
    indicator.remove();
  });

  return indicator;
}

// Функция для создания и обновления боковой панели с найденными квартирами
function createOrUpdateFoundApartmentsSidebar(
  foundApartments,
  apartmentNumbers,
  defectMap = {},
  isSearchComplete = false
) {
  let sidebar = document.querySelector(".found-apartments-sidebar");

  if (!sidebar) {
    sidebar = document.createElement("div");
    sidebar.className = "found-apartments-sidebar";
    document.body.appendChild(sidebar);

    // Добавляем стили для боковой панели
    const style = document.createElement("style");
    style.textContent = `
      .found-apartments-sidebar {
        position: fixed;
        right: 20px;
        top: 80px;
        width: 300px;
        max-height: calc(100vh - 100px);
        background: rgba(255, 255, 255, 0.95);
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 999;
        overflow-y: auto;
        padding: 15px;
        font-family: Arial, sans-serif;
        backdrop-filter: blur(5px);
        transition: opacity 0.3s ease;
      }
      .found-apartments-sidebar.hidden {
        opacity: 0;
        pointer-events: none;
      }
      .found-apartments-sidebar.visible {
        opacity: 1;
        pointer-events: auto;
      }
      .found-apartments-sidebar .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }
      .found-apartments-sidebar .title {
        font-size: 16px;
        font-weight: bold;
        color: #333;
      }
      .found-apartments-sidebar .close-button {
        width: 24px;
        height: 24px;
        border: none;
        background: none;
        color: #666;
        font-size: 18px;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s;
      }
      .found-apartments-sidebar .close-button:hover {
        opacity: 1;
      }
      .found-apartments-sidebar .apartment-list {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .found-apartments-sidebar .apartment-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px;
        margin-bottom: 5px;
        background: rgba(245, 245, 245, 0.9);
        border-radius: 4px;
        transition: background-color 0.2s;
      }
      .found-apartments-sidebar .apartment-item:hover {
        background: rgba(227, 242, 253, 0.9);
      }
      .found-apartments-sidebar .apartment-number {
        font-weight: bold;
        color: #2196F3;
      }
      .found-apartments-sidebar .apartment-actions {
        display: flex;
        gap: 5px;
      }
      .found-apartments-sidebar .action-button {
        padding: 4px 12px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        background: #1976d2;
        color: #fff;
        transition: background 0.2s;
      }
      .found-apartments-sidebar .action-button:hover {
        background: #0d47a1;
      }
      .found-apartments-sidebar .progress {
        margin-top: 10px;
        padding: 8px;
        background: rgba(245, 245, 245, 0.9);
        border-radius: 4px;
        font-size: 12px;
        color: #666;
      }
      .found-apartments-sidebar .not-found-list {
        margin-top: 15px;
        padding: 10px;
        background: rgba(255, 243, 224, 0.9);
        border-radius: 4px;
        border: 1px solid rgba(255, 224, 178, 0.9);
      }
      .found-apartments-sidebar .not-found-title {
        font-size: 14px;
        font-weight: bold;
        color: #f57c00;
        margin-bottom: 5px;
      }
      .found-apartments-sidebar .not-found-items {
        font-size: 12px;
        color: #666;
      }
    `;
    document.head.appendChild(style);
  }

  // Обновляем содержимое боковой панели
  sidebar.innerHTML = `
    <div class="header">
      <div class="title">Найденные квартиры</div>
      <button class="close-button">&times;</button>
    </div>
    <div class="progress">Найдено: ${foundApartments.size} из ${
    apartmentNumbers.length
  }</div>
    <ul class="apartment-list">
      ${Array.from(foundApartments)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map(
          (apartmentNumber) => `
          <li class="apartment-item">
            <span class="apartment-number">Квартира ${apartmentNumber}</span>
            <div class="apartment-actions">
              <button class="action-button copy-button" data-apartment="${apartmentNumber}">Копировать</button>
              <button class="action-button goto-button" data-defect="${
                defectMap[apartmentNumber] || ""
              }">Перейти</button>
            </div>
          </li>
        `
        )
        .join("")}
    </ul>
    ${
      isSearchComplete &&
      Array.from(apartmentNumbers).filter((num) => !foundApartments.has(num))
        .length > 0
        ? `
      <div class="not-found-list">
        <div class="not-found-title">Не найдены следующие квартиры:</div>
        <div class="not-found-items">${Array.from(apartmentNumbers)
          .filter((num) => !foundApartments.has(num))
          .sort((a, b) => parseInt(a) - parseInt(b))
          .join(", ")}</div>
      </div>
    `
        : ""
    }
  `;

  // Добавляем обработчик для кнопки закрытия
  const closeButton = sidebar.querySelector(".close-button");
  closeButton.addEventListener("click", () => {
    sidebar.classList.add("hidden");
    setTimeout(() => {
      sidebar.remove();
    }, 300);
  });

  // Добавляем обработчики для кнопок 'Копировать' и 'Перейти'
  sidebar.querySelectorAll(".copy-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const apt = btn.getAttribute("data-apartment");
      navigator.clipboard.writeText(apt);
    });
  });

  sidebar.querySelectorAll(".goto-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const defectId = btn.getAttribute("data-defect");
      if (defectId) {
        window.open(
          `https://control.samoletgroup.ru/repair-defect/${defectId}/common-info`,
          "_blank"
        );
      }
    });
  });

  // Показываем панель с анимацией
  sidebar.classList.add("visible");
  return sidebar;
}

// Функция поиска квартир на текущей странице
async function searchApartmentsOnPage(apartmentNumbers, foundApartments) {
  console.log("Ищем квартиры на текущей странице:", apartmentNumbers);
  const rows = document.querySelectorAll("tbody tr");
  let foundCount = 0;

  // Очищаем предыдущие выделения
  document.querySelectorAll(".found-apartment-row").forEach((row) => {
    row.classList.remove("found-apartment-row");
  });

  for (const row of rows) {
    const cells = row.getElementsByTagName("td");
    const kvCell = cells[7];
    if (!kvCell) continue;

    const apartmentNumber = String(kvCell.textContent).trim();
    if (
      apartmentNumbers.includes(apartmentNumber) &&
      !foundApartments.has(apartmentNumber)
    ) {
      console.log(`Нашли квартиру ${apartmentNumber} на текущей странице`);
      foundCount++;
      foundApartments.add(apartmentNumber);

      // Выделяем найденную квартиру
      row.classList.add("found-apartment-row");

      // Прокручиваем к найденной квартире
      row.scrollIntoView({ behavior: "smooth", block: "center" });

      const links = row.querySelectorAll("a");
      if (links.length > 0) {
        const detailUrl = links[0].href;
        console.log(`Открываем детали квартиры ${apartmentNumber}`);
        try {
          // Открываем детали в новой вкладке
          await chrome.runtime.sendMessage({
            action: "openNewTab",
            url: detailUrl,
          });
          console.log("Вкладка с деталями квартиры успешно открыта");

          // Пауза перед открытием следующей вкладки
          await sleep(1000);
        } catch (error) {
          console.error("Ошибка при открытии вкладки с деталями:", error);
        }
      }

      // --- Новый код: ищем номер дефекта ---
      const defectSpan = row.querySelector('span[data-testid="tend-ui-text"]');
      if (defectSpan) {
        defectMap[apartmentNumber] = defectSpan.textContent.trim();
      }
    }
  }

  // После нахождения квартир обновляем боковую панель (без списка ненайденных)
  createOrUpdateFoundApartmentsSidebar(
    foundApartments,
    apartmentNumbers,
    defectMap,
    false
  );

  return foundCount;
}

// Функция для множественного поиска квартир
async function handleMultipleApartments(apartmentNumbers) {
  console.log("Начинаем множественный поиск квартир:", apartmentNumbers);

  // Создаем Set для отслеживания найденных квартир
  const foundApartments = new Set();

  // Получаем общее количество страниц
  const totalPages = await getTotalPages();
  const currentPage = await getCurrentPageNumber();
  console.log(`Всего страниц: ${totalPages}, текущая страница: ${currentPage}`);

  // Создаем индикатор прогресса
  const progressIndicator = createOrUpdateIndicator(
    `
    <div class="title">Подготовка к поиску</div>
    <div class="details">Всего квартир для поиска: ${apartmentNumbers.length}</div>
    <div class="progress">Страница ${currentPage} из ${totalPages}</div>
  `,
    "info"
  );

  // Создаем боковую панель в начале поиска (без списка ненайденных)
  createOrUpdateFoundApartmentsSidebar(
    foundApartments,
    apartmentNumbers,
    defectMap,
    false
  );

  try {
    // Сначала ищем на текущей странице
    progressIndicator.innerHTML = `
      <div class="title">Поиск на текущей странице</div>
      <div class="progress">Страница ${currentPage} из ${totalPages}</div>
    `;

    const foundOnCurrentPage = await searchApartmentsOnPage(
      apartmentNumbers,
      foundApartments
    );

    // Если все квартиры найдены, завершаем поиск
    if (foundApartments.size === apartmentNumbers.length) {
      createOrUpdateIndicator(
        `
        <div class="title">Поиск завершен</div>
        <div class="details">Все квартиры найдены!</div>
        <div class="progress">Найдено: ${foundApartments.size} из ${apartmentNumbers.length}</div>
      `,
        "success"
      );
      return;
    }

    await sleep(1000);

    // Проходим по остальным страницам
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (pageNum === currentPage) continue;

      // Если все квартиры найдены, прекращаем поиск
      if (foundApartments.size === apartmentNumbers.length) {
        createOrUpdateIndicator(
          `
          <div class="title">Поиск завершен</div>
          <div class="details">Все квартиры найдены!</div>
          <div class="progress">Найдено: ${foundApartments.size} из ${apartmentNumbers.length}</div>
        `,
          "success"
        );
        break;
      }

      createOrUpdateIndicator(
        `
        <div class="title">Переход на страницу ${pageNum}</div>
        <div class="progress">Страница ${pageNum} из ${totalPages} | Найдено: ${foundApartments.size} из ${apartmentNumbers.length}</div>
      `,
        "info"
      );

      const pageChanged = await goToPage(pageNum);
      if (!pageChanged) {
        console.log(`Не удалось перейти на страницу ${pageNum}`);
        continue;
      }

      // Ждем загрузки страницы
      await sleep(2000);

      // Ищем квартиры на текущей странице
      await searchApartmentsOnPage(apartmentNumbers, foundApartments);

      // Пауза между страницами
      await sleep(1000);
    }

    // Финальное сообщение только если поиск действительно завершен
    if (foundApartments.size === apartmentNumbers.length) {
      createOrUpdateIndicator(
        `
        <div class="title">Поиск завершен</div>
        <div class="details">Все квартиры найдены!</div>
        <div class="progress">Найдено: ${foundApartments.size} из ${apartmentNumbers.length}</div>
      `,
        "success"
      );
    } else {
      createOrUpdateIndicator(
        `
        <div class="title">Поиск завершен</div>
        <div class="details">Найдено не все квартиры</div>
        <div class="progress">Найдено: ${foundApartments.size} из ${apartmentNumbers.length}</div>
      `,
        "info"
      );
    }

    // Обновляем боковую панель после завершения поиска (показываем ненайденные)
    createOrUpdateFoundApartmentsSidebar(
      foundApartments,
      apartmentNumbers,
      defectMap,
      true
    );
  } catch (error) {
    console.error("Ошибка при поиске:", error);
    createOrUpdateIndicator(
      `
      <div class="title">Ошибка</div>
      <div class="details">Произошла ошибка при поиске</div>
    `,
      "error"
    );
  }
}

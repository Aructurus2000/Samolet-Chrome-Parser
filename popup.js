document.addEventListener("DOMContentLoaded", () => {
  const apartmentInput = document.getElementById("apartmentNumber");
  const filterButton = document.getElementById("filterButton");
  const gotoButton = document.getElementById("gotoButton");
  const statusDiv = document.getElementById("status");
  const lastInputDiv = document.getElementById("lastInput");

  function renderLastInput(value) {
    if (!value) {
      lastInputDiv.textContent = "";
      return;
    }
    lastInputDiv.innerHTML = `
      <span style="font-size:11.5pt;">Последний ввод:</span> 
      <span class="last-input-value" style="font-weight:bold;">${value}</span> 
      <button id="repeatLastInput" style="
        position:absolute; top:0; right:0; height:100%; border-radius:0 6px 6px 0; padding:0 16px; 
        font-size:12px; background:#1976d2; color:#fff; border:none; cursor:pointer;">
        Повторить
      </button>`;
    document.getElementById("repeatLastInput").onclick = () => {
      apartmentInput.value = value;
      apartmentInput.focus();
    };
  }

  chrome.storage.local.get(["lastSearch"], (result) => {
    renderLastInput(result.lastSearch);
  });

  function saveAndShowLastInput(value) {
    chrome.storage.local.set({ lastSearch: value });
    renderLastInput(value);
  }

  function updateStatus(message, isError = false) {
    statusDiv.textContent = message;
    statusDiv.style.color = isError ? "#f44336" : "#666";
  }

  function setButtonsDisabled(disabled) {
    filterButton.disabled = disabled;
    gotoButton.disabled = disabled;
  }

  async function sendMessage(action, payload = {}) {
    setButtonsDisabled(true);
    updateStatus("Обработка...");

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab.url.includes("control.samoletgroup.ru")) {
        updateStatus("Откройте сайт control.samoletgroup.ru", true);
        setButtonsDisabled(false);
        return false;
      }
      await chrome.tabs.sendMessage(tab.id, { action, ...payload });
      return true;
    } catch (e) {
      console.error("Ошибка:", e);
      updateStatus("Ошибка при обработке", true);
      setButtonsDisabled(false);
      return false;
    }
  }

  async function handleFilter() {
    const input = apartmentInput.value.trim();
    if (!input) {
      updateStatus("Введите номер квартиры", true);
      return;
    }
    const apartmentNumbers = input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    saveAndShowLastInput(input);

    if (apartmentNumbers.length === 1) {
      if (
        await sendMessage("filterByApartment", {
          apartmentNumber: apartmentNumbers[0],
          mode: "search",
        })
      ) {
        window.close();
      }
    } else {
      if (await sendMessage("filterMultipleApartments", { apartmentNumbers })) {
        window.close();
      }
    }
  }

  async function handleGoto() {
    const input = apartmentInput.value.trim();
    if (!input) {
      updateStatus("Введите номер квартиры", true);
      return;
    }
    const apartmentNumbers = input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (apartmentNumbers.length !== 1) {
      updateStatus("Для перехода укажите только один номер квартиры", true);
      return;
    }
    saveAndShowLastInput(input);

    if (
      await sendMessage("filterByApartment", {
        apartmentNumber: apartmentNumbers[0],
        mode: "goto",
      })
    ) {
      window.close();
    }
  }

  filterButton.addEventListener("click", handleFilter);
  gotoButton.addEventListener("click", handleGoto);

  apartmentInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") filterButton.click();
  });
});

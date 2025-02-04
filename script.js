const API_URL = "https://mkntw-github-io.onrender.com"; // Проверьте корректность URL
let currentUserId = null;
let pendingMinedCoins = parseFloat(localStorage.getItem("pendingMinedCoins")) || 0;
let mineTimer = null;
let localBalance = 0;
let updateInterval = null;

/* ================================
   ФУНКЦИИ РАБОТЫ С UI
   ================================ */
function logout() {
  localStorage.removeItem("userId");
  currentUserId = null;
  hideMainUI();
  closeAllModals();
  document.getElementById("userIdDisplay").textContent = "";
  clearInterval(updateInterval);
  openAuthModal();
}

function updateTopBar() {
  const userIdDisplay = document.getElementById("userIdDisplay");
  userIdDisplay.textContent = currentUserId ? `ID: ${currentUserId}` : "";
}

function showMainUI() {
  // Создаем динамически верхнюю панель, если её нет
  if (!document.getElementById("topBar")) {
    const topBar = document.createElement("div");
    topBar.id = "topBar";
    topBar.innerHTML = `
      <div id="topBarLeft">
        <div id="appTitle">GugaCoin</div>
        <div id="userIdDisplay"></div>
      </div>
      <div id="topBarRight">
        <button id="logoutBtn">Выход</button>
      </div>
    `;
    document.body.appendChild(topBar);
    document.getElementById("logoutBtn").addEventListener("click", logout);
  }
  document.getElementById("topBar").classList.remove("hidden");

  // Создаем динамически нижнюю панель, если её нет
  if (!document.getElementById("bottomBar")) {
    const bottomBar = document.createElement("div");
    bottomBar.id = "bottomBar";
    bottomBar.innerHTML = `
      <button id="paymentBtn">Перевести</button>
      <button id="historyBtn">История</button>
      <button id="exchangeBtn">Обменять</button>
    `;
    document.body.appendChild(bottomBar);
    document.getElementById("paymentBtn").addEventListener("click", openPaymentModal);
    document.getElementById("historyBtn").addEventListener("click", openHistoryModal);
    document.getElementById("exchangeBtn").addEventListener("click", openExchangeModal);
  }
  document.getElementById("bottomBar").classList.remove("hidden");

  // Показываем баланс и контейнер кнопки "Майнить"
  document.getElementById("balanceDisplay").classList.remove("hidden");
  document.getElementById("mineContainer").classList.remove("hidden");

  updateInterval = setInterval(fetchUserData, 2000);
}

function hideMainUI() {
  if (document.getElementById("topBar")) {
    document.getElementById("topBar").classList.add("hidden");
  }
  if (document.getElementById("bottomBar")) {
    document.getElementById("bottomBar").classList.add("hidden");
  }
  document.getElementById("balanceDisplay").classList.add("hidden");
  document.getElementById("mineContainer").classList.add("hidden");
  clearInterval(updateInterval);
}

function closeAllModals() {
  const modals = document.querySelectorAll(".modal");
  modals.forEach((modal) => modal.classList.add("hidden"));
}

/**
 * Создает модальное окно и добавляет обработчики закрытия.
 * Если клик (или touch) происходит по оверлею (e.target === modal), окно закрывается.
 */
function createModal(id, content) {
  let modal = document.getElementById(id);
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = id;
  modal.className = "modal hidden";
  modal.innerHTML = `<div class="modal-content">${content}</div>`;
  document.body.appendChild(modal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal(id);
      fetchUserData();
    }
  });
  modal.addEventListener("touchend", (e) => {
    setTimeout(() => {
      if (e.target === modal) {
        closeModal(id);
        fetchUserData();
      }
    }, 100);
  });
  return modal;
}
  

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("hidden");
    fetchUserData();
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add("hidden");
  fetchUserData();
}

/* ------------------------------
   МОДАЛЬНОЕ ОКНО АВТОРИЗАЦИИ
------------------------------ */
function removeAuthModal() {
  const authModal = document.getElementById("authModal");
  if (authModal) authModal.remove();
}

function openLoginSection() {
  const loginSection = document.getElementById("loginSection");
  const registerSection = document.getElementById("registerSection");
  if (loginSection) loginSection.style.display = "block";
  if (registerSection) registerSection.style.display = "none";
}

function openRegisterSection() {
  const loginSection = document.getElementById("loginSection");
  const registerSection = document.getElementById("registerSection");
  if (loginSection) loginSection.style.display = "none";
  if (registerSection) registerSection.style.display = "block";
}

function openAuthModal() {
  hideMainUI();
  let authModal = document.getElementById("authModal");
  if (!authModal) {
    authModal = document.createElement("div");
    authModal.id = "authModal";
    authModal.className = "modal hidden";
    authModal.innerHTML = `
      <div class="modal-content">
        <h3>GugaCoin</h3>
        <div id="authForm">
          <div id="loginSection">
            <h4 style="text-align: left;">Вход</h4>
            <input type="text" id="loginInput" placeholder="Логин">
            <input type="password" id="passwordInput" placeholder="Пароль">
            <button id="loginSubmitBtn">Войти</button>
          </div>
          <div id="registerSection" style="display: none;">
            <h4 style="text-align: left;">Регистрация</h4>
            <input type="text" id="regLogin" placeholder="Логин">
            <input type="password" id="regPassword" placeholder="Пароль">
            <button id="registerSubmitBtn">Зарегистрироваться</button>
          </div>
        </div>
        <!-- Кнопка переключения вынесена в самый низ окна авторизации -->
        <button id="toggleAuthBtn" style="margin-top:20px;">Войти/Зарегестрироваться</button>
      </div>
    `;
    document.body.appendChild(authModal);
    const loginSubmitBtn = authModal.querySelector("#loginSubmitBtn");
    const registerSubmitBtn = authModal.querySelector("#registerSubmitBtn");
    const toggleAuthBtn = authModal.querySelector("#toggleAuthBtn");
    if (loginSubmitBtn) loginSubmitBtn.addEventListener("click", login);
    if (registerSubmitBtn) registerSubmitBtn.addEventListener("click", register);
    if (toggleAuthBtn) {
      toggleAuthBtn.addEventListener("click", () => {
        const loginSection = authModal.querySelector("#loginSection");
        const registerSection = authModal.querySelector("#registerSection");
        if (loginSection.style.display === "block") {
          loginSection.style.display = "none";
          registerSection.style.display = "block";
        } else {
          loginSection.style.display = "block";
          registerSection.style.display = "none";
        }
      });
    }
  }
  openLoginSection();
  openModal("authModal");
}

function formatBalance(balance) {
  return parseFloat(balance).toFixed(5);
}

/* ================================
   ФУНКЦИИ ДОБЫЧИ МОНЕТ
   ================================ */
function mineCoins() {
  if (!currentUserId) return;
  clearInterval(updateInterval);
  pendingMinedCoins = parseFloat((pendingMinedCoins + 0.00001).toFixed(5));
  localStorage.setItem("pendingMinedCoins", pendingMinedCoins);
  localBalance = parseFloat((localBalance + 0.00001).toFixed(5));
  updateBalanceUI();
  if (mineTimer) clearTimeout(mineTimer);
  mineTimer = setTimeout(() => {
    flushMinedCoins();
    updateInterval = setInterval(fetchUserData, 2000);
  }, 1000);
}

function updateBalanceUI() {
  const balanceValue = document.getElementById("balanceValue");
  if (balanceValue) {
    balanceValue.textContent = formatBalance(localBalance);
  }
}

async function flushMinedCoins() {
  if (!currentUserId || pendingMinedCoins <= 0) return;
  try {
    const response = await fetch(`${API_URL}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUserId, amount: pendingMinedCoins })
    });
    if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
    pendingMinedCoins = 0;
    localStorage.removeItem("pendingMinedCoins");
    fetchUserData();
  } catch (error) {
    console.error("[FlushMinedCoins] Ошибка:", error);
  }
}

function flushMinedCoinsSync() {
  if (!currentUserId || pendingMinedCoins <= 0) return;
  const xhr = new XMLHttpRequest();
  xhr.open("POST", `${API_URL}/update`, false);
  xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
  try {
    xhr.send(JSON.stringify({ userId: currentUserId, amount: pendingMinedCoins }));
    pendingMinedCoins = 0;
    localStorage.removeItem("pendingMinedCoins");
  } catch (error) {
    console.error("[FlushMinedCoinsSync] Ошибка:", error);
  }
}

/* ================================
   ФУНКЦИИ РАБОТЫ С ПОЛЬЗОВАТЕЛЕМ И UI
   ================================ */
function createUI() {
  // Создаем динамически верхнюю панель, если её нет
  if (!document.getElementById("topBar")) {
    const topBar = document.createElement("div");
    topBar.id = "topBar";
    topBar.innerHTML = `
      <div id="topBarLeft">
        <div id="appTitle">GugaCoin</div>
        <div id="userIdDisplay"></div>
      </div>
      <div id="topBarRight">
        <button id="logoutBtn">Выход</button>
      </div>
    `;
    document.body.appendChild(topBar);
    document.getElementById("logoutBtn").addEventListener("click", logout);
  }
  document.getElementById("topBar").classList.remove("hidden");

  // Создаем динамически нижнюю панель, если её нет
  if (!document.getElementById("bottomBar")) {
    const bottomBar = document.createElement("div");
    bottomBar.id = "bottomBar";
    bottomBar.innerHTML = `
      <button id="paymentBtn">Перевести</button>
      <button id="historyBtn">История</button>
      <button id="exchangeBtn">Обменять</button>
    `;
    document.body.appendChild(bottomBar);
    document.getElementById("paymentBtn").addEventListener("click", openPaymentModal);
    document.getElementById("historyBtn").addEventListener("click", openHistoryModal);
    document.getElementById("exchangeBtn").addEventListener("click", openExchangeModal);
  }
  document.getElementById("bottomBar").classList.remove("hidden");

  // Показываем баланс и контейнер кнопки "Майнить"
  document.getElementById("balanceDisplay").classList.remove("hidden");
  document.getElementById("mineContainer").classList.remove("hidden");

  updateInterval = setInterval(fetchUserData, 2000);
}

function updateUI() {
  if (currentUserId) {
    updateTopBar();
    showMainUI();
    removeAuthModal();
  } else {
    hideMainUI();
    openAuthModal();
  }
}

async function fetchUserData() {
  try {
    const response = await fetch(`${API_URL}/user?userId=${currentUserId}`);
    if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
    const data = await response.json();
    if (data.success && data.user) {
      const balance = parseFloat(data.user.balance || 0);
      localBalance = balance;
      updateBalanceUI();
      updateExchangeModalInfo(data.user);
    } else {
      console.error("[Fetch User Data] Некорректный ответ сервера");
      localBalance = 0;
      updateBalanceUI();
    }
  } catch (error) {
    console.error("[Fetch User Data] Ошибка:", error.message);
    localBalance = 0;
    updateBalanceUI();
  }
}

/* ================================
   МОДАЛЬНЫЕ ОКНА
   ================================ */

/* Форматирование дат */
function getDateLabel(dateObj) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dateObj.toDateString() === today.toDateString()) return "Сегодня";
  if (dateObj.toDateString() === yesterday.toDateString()) return "Вчера";
  const day = ("0" + dateObj.getDate()).slice(-2);
  const month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
  const year = dateObj.getFullYear();
  return `${day}.${month}.${year}`;
}

function displayTransactionHistory(transactions) {
  const transactionList = document.getElementById("transactionList");
  transactionList.innerHTML = "";
  if (transactions.length === 0) {
    transactionList.innerHTML = "<li>Нет операций</li>";
    return;
  }
  const groups = {};
  transactions.forEach(tx => {
    const dateObj = new Date(tx.created_at);
    const dateStr = getDateLabel(dateObj);
    if (!groups[dateStr]) groups[dateStr] = [];
    groups[dateStr].push(tx);
  });
  const sortedDates = Object.keys(groups).sort((a, b) => {
    const dateA = new Date(groups[a][0].created_at);
    const dateB = new Date(groups[b][0].created_at);
    return dateB - dateA;
  });
  sortedDates.forEach(dateStr => {
    const groupContainer = document.createElement("div");
    groupContainer.className = "history-group";
    const dateHeader = document.createElement("div");
    dateHeader.className = "history-date";
    dateHeader.textContent = dateStr;
    groupContainer.appendChild(dateHeader);
    groups[dateStr].forEach(tx => {
      const opContainer = document.createElement("div");
      opContainer.className = "history-item";
      const opType = tx.type === "sent" ? "Исходящая операция" : "Входящая операция";
      const counterpart = tx.type === "sent" ? `Кому: ${tx.to_user_id}` : `От кого: ${tx.from_user_id}`;
      const amountStr = `Количество: ₲ ${formatBalance(tx.amount)}`;
      const timeStr = `Время: ${new Date(tx.created_at).toLocaleTimeString("ru-RU")}`;
      opContainer.innerHTML = `<div>${opType}</div>
                               <div>${counterpart}</div>
                               <div>${amountStr}</div>
                               <div>${timeStr}</div>`;
      groupContainer.appendChild(opContainer);
    });
    groupContainer.style.width = "100%";
    groupContainer.style.marginLeft = "auto";
    groupContainer.style.marginRight = "auto";
    transactionList.appendChild(groupContainer);
  });
}

function openPaymentModal() {
  const modalContent = `
    <h3>Перевести</h3>
    <div id="transferContent" style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; max-width: 400px; margin: 0 auto;">
      <div style="width: 100%; text-align: center;">
        <label for="toUserIdInput">Кому (ID):</label>
        <input type="text" id="toUserIdInput" placeholder="Введите ID получателя">
      </div>
      <div style="width: 100%; text-align: center; margin: 15px 0;">
        <label for="transferAmountInput">Количество:</label>
        <input type="number" id="transferAmountInput" step="0.00001" placeholder="Введите сумму">
      </div>
      <button id="sendTransferBtn" style="max-width: 200px; margin: 15px auto;">Отправить</button>
    </div>
  `;
  const modal = createModal("paymentModal", modalContent);
  const sendTransferBtn = modal.querySelector("#sendTransferBtn");
  if (sendTransferBtn) {
    sendTransferBtn.addEventListener("click", async () => {
      await sendTransfer();
    });
  }
  openModal("paymentModal");
}

function openHistoryModal() {
  const modal = createModal("historyModal", `
    <h3>История операций</h3>
    <div class="scrollable-content">
      <ul id="transactionList"></ul>
    </div>
  `);
  fetchTransactionHistory();
  openModal("historyModal");
}

async function fetchTransactionHistory() {
  try {
    const response = await fetch(`${API_URL}/transactions?userId=${currentUserId}`);
    if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
    const data = await response.json();
    if (data.success && data.transactions) {
      displayTransactionHistory(data.transactions);
    } else {
      console.error("[Fetch Transactions] Некорректный ответ сервера");
    }
  } catch (error) {
    console.error("[Fetch Transactions] Ошибка:", error.message);
  }
}

function openExchangeModal() {
  const modalContent = `
    <h3>Обменять</h3>
    <div id="exchangeContent" style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%;">
      <p id="exchangeRateInfo"></p>
      <p id="rubBalanceInfo"></p>
      <p id="halvingLevel"></p>
    </div>
  `;
  const modal = createModal("exchangeModal", modalContent);
  fetchUserData();
  openModal("exchangeModal");
}

function updateExchangeModalInfo(user) {
  const halvingStep = user.halvingStep || 0;
  const rubMultiplier = 1 + halvingStep * 0.02;
  const rubBalance = (localBalance * rubMultiplier).toFixed(2);
  const exchangeRateInfo = document.getElementById("exchangeRateInfo");
  const rubBalanceInfo = document.getElementById("rubBalanceInfo");
  const halvingLevel = document.getElementById("halvingLevel");
  if (exchangeRateInfo) {
    exchangeRateInfo.textContent = `Курс: 1 ₲ = ${rubMultiplier.toFixed(2)} ₽`;
  }
  if (rubBalanceInfo) {
    rubBalanceInfo.textContent = `Баланс: ${rubBalance} ₽`;
  }
  if (halvingLevel) {
    halvingLevel.textContent = `Уровень халвинга: ${halvingStep}`;
  }
}

async function sendTransfer() {
  const toUserId = document.getElementById("toUserIdInput")?.value;
  const amount = parseFloat(document.getElementById("transferAmountInput")?.value);
  if (!toUserId || !amount || amount <= 0) {
    alert("❌ Введите корректные данные");
    return;
  }
  if (toUserId === currentUserId) {
    alert("❌ Нельзя перевести самому себе");
    return;
  }
  try {
    const response = await fetch(`${API_URL}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromUserId: currentUserId,
        toUserId: toUserId,
        amount: amount
      })
    });
    const data = await response.json();
    if (data.success) {
      alert(`✅ Перевод успешен! Новый баланс: ${formatBalance(data.fromBalance)}`);
      closeModal("paymentModal");
      fetchUserData();
    } else {
      alert(`❌ Ошибка перевода: ${data.error}`);
    }
  } catch (error) {
    console.error("Ошибка при переводе:", error);
    alert("🚫 Ошибка сети");
  }
}

async function register() {
  const loginVal = document.getElementById("regLogin")?.value;
  const password = document.getElementById("regPassword")?.value;
  if (!loginVal || !password) {
    alert("❌ Введите логин и пароль");
    return;
  }
  try {
    const response = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: loginVal, password })
    });
    const data = await response.json();
    if (data.success) {
      alert(`✅ Аккаунт создан! Ваш ID: ${data.userId}`);
      currentUserId = data.userId;
      localStorage.setItem("userId", currentUserId);
      createUI();
      updateUI();
      fetchUserData();
    } else {
      alert(`❌ Ошибка регистрации: ${data.error}`);
    }
  } catch (error) {
    console.error(error);
    alert("🚫 Ошибка сети");
  }
}

async function login() {
  const loginVal = document.getElementById("loginInput")?.value;
  const password = document.getElementById("passwordInput")?.value;
  if (!loginVal || !password) {
    alert("❌ Введите логин и пароль");
    return;
  }
  try {
    const response = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: loginVal, password })
    });
    const data = await response.json();
    if (data.success) {
      currentUserId = data.userId;
      localStorage.setItem("userId", currentUserId);
      createUI();
      updateUI();
      fetchUserData();
      alert(`✅ Успешный вход! Ваш ID: ${currentUserId}`);
    } else {
      alert(`❌ Ошибка входа: ${data.error}`);
    }
  } catch (error) {
    console.error(error);
    alert("🚫 Ошибка сети");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (pendingMinedCoins > 0) {
    flushMinedCoins();
  }
  const savedUserId = localStorage.getItem("userId");
  if (savedUserId) {
    currentUserId = savedUserId;
    createUI();
    fetchUserData();
    updateUI();
  } else {
    openAuthModal();
  }
});

window.addEventListener("beforeunload", () => {
  if (pendingMinedCoins > 0) {
    flushMinedCoinsSync();
  }
});

document.getElementById("mineBtn")?.addEventListener("click", mineCoins);

// Глобальная доступность функции sendTransfer
window.sendTransfer = sendTransfer;

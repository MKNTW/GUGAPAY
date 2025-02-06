/* ================================
   ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ / НАСТРОЙКИ
================================ */
const API_URL = "https://mkntw-github-io.onrender.com"; // Обновлённый URL

// Идентификаторы
let currentUserId = null;      // если вошли как пользователь
let currentMerchantId = null;  // если вошли как мерчант

// Майнинг (для пользователей)
let pendingMinedCoins = parseFloat(localStorage.getItem("pendingMinedCoins")) || 0;
let isMining = false;
let mineTimer = null;
let localBalance = 0; // баланс пользователя

// Баланс мерчанта (если требуется)
let merchantBalance = 0; 

// Интервалы обновления
let updateInterval = null;

/* ================================
   ОСНОВНОЙ UI + ФУНКЦИИ
================================ */
function logout() {
  localStorage.removeItem("userId");
  currentUserId = null;
  currentMerchantId = null;

  // Удаляем UI
  document.getElementById("topBar")?.remove();
  document.getElementById("bottomBar")?.remove();
  document.getElementById("balanceDisplay")?.classList.add("hidden");
  document.getElementById("mineContainer")?.classList.add("hidden");
  document.getElementById("merchantInterface")?.remove();

  closeAllModals();
  clearInterval(updateInterval);

  // Показываем окно авторизации
  openAuthModal();
}

function closeAllModals() {
  document.querySelectorAll(".modal").forEach(m => m.classList.add("hidden"));
}

function createModal(id, content) {
  let modal = document.getElementById(id);
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = id;
  modal.className = "modal hidden";
  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-content">${content}</div>
  `;
  document.body.appendChild(modal);

  const closeOnOverlay = ["paymentModal", "historyModal", "exchangeModal", "merchantPayModal", "confirmMerchantPaymentModal"];
  if (closeOnOverlay.includes(id)) {
    const overlay = modal.querySelector(".modal-overlay");
    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          modal.remove();
        }
      });
    }
  }
  return modal;
}

function openModal(modalId) {
  document.getElementById(modalId)?.classList.remove("hidden");
}

function closeModal(modalId) {
  document.getElementById(modalId)?.classList.add("hidden");
}

/* ================================
   ОКНО АВТОРИЗАЦИИ
================================ */
function openAuthModal() {
  hideMainUI();
  document.getElementById("merchantInterface")?.remove();

  let authModal = document.getElementById("authModal");
  if (!authModal) {
    authModal = document.createElement("div");
    authModal.id = "authModal";
    authModal.className = "modal hidden";
    authModal.innerHTML = `
      <div class="modal-content" style="width:90%;max-width:400px;">
        <h3>GugaCoin</h3>
        <div id="authForm">
          <div id="loginSection">
            <h4 style="text-align:left;">Вход</h4>
            <input type="text" id="loginInput" placeholder="Логин">
            <input type="password" id="passwordInput" placeholder="Пароль">
            <button id="loginSubmitBtn">Войти</button>
          </div>
          <div id="registerSection" style="display:none; margin-top:20px;">
            <h4 style="text-align:left;">Регистрация</h4>
            <input type="text" id="regLogin" placeholder="Логин">
            <input type="password" id="regPassword" placeholder="Пароль">
            <button id="registerSubmitBtn">Зарегистрироваться</button>
          </div>
        </div>
        <button id="toggleAuthBtn" style="margin-top:20px;">Войти/Зарегистрироваться</button>
      </div>
    `;
    document.body.appendChild(authModal);

    document.getElementById("loginSubmitBtn").addEventListener("click", login);
    document.getElementById("registerSubmitBtn").addEventListener("click", register);
    document.getElementById("toggleAuthBtn").addEventListener("click", () => {
      const loginSection = document.getElementById("loginSection");
      const registerSection = document.getElementById("registerSection");
      if (loginSection.style.display === "block") {
        loginSection.style.display = "none";
        registerSection.style.display = "block";
      } else {
        loginSection.style.display = "block";
        registerSection.style.display = "none";
      }
    });
  }
  document.getElementById("loginSection").style.display = "block";
  document.getElementById("registerSection").style.display = "none";
  authModal.classList.remove("hidden");
}

function hideMainUI() {
  document.getElementById("topBar")?.classList.add("hidden");
  document.getElementById("bottomBar")?.classList.add("hidden");
  document.getElementById("balanceDisplay")?.classList.add("hidden");
  document.getElementById("mineContainer")?.classList.add("hidden");
  clearInterval(updateInterval);
}

/* ================================
   ЛОГИКА ВХОДА / РЕГИСТРАЦИИ
================================ */
async function login() {
  const loginVal = document.getElementById("loginInput")?.value;
  const passVal = document.getElementById("passwordInput")?.value;
  if (!loginVal || !passVal) {
    alert("Введите логин и пароль");
    return;
  }

  try {
    // 1) Пробуем как пользователь
    let resp = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: loginVal, password: passVal })
    });
    let data = await resp.json();

    if (resp.ok && data.success) {
      // Успех: пользователь
      currentUserId = data.userId;
      localStorage.setItem("userId", currentUserId);

      document.getElementById("authModal")?.remove();
      createUI();
      updateUI();
      fetchUserData();
    } else {
      // Сообщение при блокировке или ошибке
      console.log("Ошибка входа пользователя:", data.error);
      if (data.error.includes("блокирован")) {
        alert("Учётная запись заблокирована");
        return;
      }
      // 2) Пробуем мерчанта
      const merchResp = await fetch(`${API_URL}/merchantLogin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginVal, password: passVal })
      });
      const merchData = await merchResp.json();
      if (merchResp.ok && merchData.success) {
        // Успех: мерчант
        currentMerchantId = merchData.merchantId;
        document.getElementById("authModal")?.remove();
        openMerchantUI();
      } else {
        console.error("Ошибка входа мерчанта:", merchData.error);
        if (merchData.error?.includes("блокирован")) {
          alert("Учётная запись заблокирована");
        } else {
          alert("Неверные данные пользователя");
        }
      }
    }
  } catch (err) {
    console.error("Ошибка сети при логине:", err);
    alert("Ошибка сети");
  }
}

async function register() {
  const loginVal = document.getElementById("regLogin")?.value;
  const passVal = document.getElementById("regPassword")?.value;
  if (!loginVal || !passVal) {
    alert("Введите логин и пароль");
    return;
  }
  try {
    const resp = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: loginVal, password: passVal })
    });
    const data = await resp.json();
    if (resp.ok && data.success) {
      alert(`Аккаунт создан! Ваш userId: ${data.userId}`);
      currentUserId = data.userId;
      localStorage.setItem("userId", currentUserId);

      document.getElementById("authModal")?.remove();
      createUI();
      updateUI();
      fetchUserData();
    } else {
      if (data.error?.includes("блокирован")) {
        alert("Учётная запись заблокирована");
      } else {
        alert("Неверные данные пользователя");
      }
    }
  } catch (err) {
    console.error("Ошибка сети при регистрации:", err);
    alert("Ошибка сети при регистрации");
  }
}

/* ================================
   UI ДЛЯ ПОЛЬЗОВАТЕЛЯ
================================ */
function createUI() {
  // Отображаем пользовательский UI (topBar, bottomBar, баланс, майнинг)
  showMainUI();
}

function showMainUI() {
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

  if (!document.getElementById("bottomBar")) {
    const bottomBar = document.createElement("div");
    bottomBar.id = "bottomBar";
    bottomBar.innerHTML = `
      <button id="paymentBtn">Перевести</button>
      <button id="historyBtn">История</button>
      <button id="exchangeBtn">Обменять</button>
      <button id="merchantPayBtn">Оплатить мерчанту</button>
    `;
    document.body.appendChild(bottomBar);

    document.getElementById("paymentBtn").addEventListener("click", openPaymentModal);
    document.getElementById("historyBtn").addEventListener("click", openHistoryModal);
    document.getElementById("exchangeBtn").addEventListener("click", openExchangeModal);
    document.getElementById("merchantPayBtn").addEventListener("click", openMerchantPayModal);
  }
  document.getElementById("bottomBar").classList.remove("hidden");

  document.getElementById("balanceDisplay")?.classList.remove("hidden");
  document.getElementById("mineContainer")?.classList.remove("hidden");

  updateInterval = setInterval(fetchUserData, 2000);
}

function updateTopBar() {
  const userIdDisplay = document.getElementById("userIdDisplay");
  if (userIdDisplay) {
    userIdDisplay.textContent = currentUserId ? `ID: ${currentUserId}` : "";
  }
}

/* ================================
   UI ДЛЯ МЕРЧАНТА
================================ */
function openMerchantUI() {
  hideMainUI();
  closeAllModals();
  document.getElementById("merchantInterface")?.remove();

  // Пример интерфейса мерчанта с балансом, генерацией QR, переводом на пользователя
  const merchDiv = document.createElement("div");
  merchDiv.id = "merchantInterface";
  merchDiv.style.textAlign = "center";
  merchDiv.style.marginTop = "70px";
  merchDiv.innerHTML = `
    <h1>Merchant Dashboard</h1>
    <p style="margin:0;">Merchant ID: <strong>${currentMerchantId}</strong></p>
    <p style="margin:5px 0 20px;">Баланс мерчанта: <span id="merchantBalanceValue">0.00000</span> ₲</p>

    <!-- Кнопка "Обновить баланс мерчанта" -->
    <button id="merchantRefreshBtn">Обновить баланс</button>

    <!-- Кнопка "Создать QR" -->
    <button id="merchantCreateQRBtn" style="margin-left:10px;">Создать QR</button>

    <!-- Кнопка "Сканировать QR" -->
    <button id="merchantScanQRBtn" style="margin-left:10px;">Сканировать QR</button>

    <!-- Кнопка "Перевести" (мерчант -> пользователь) -->
    <button id="merchantTransferBtn" style="display:block; margin:20px auto;">Перевести на пользователя</button>

    <div id="merchantQRContainer" style="margin-top:20px;"></div>

    <button style="margin-top:30px;" onclick="logout()">Выйти</button>
  `;
  document.body.appendChild(merchDiv);

  // Обработчики
  document.getElementById("merchantRefreshBtn").addEventListener("click", fetchMerchantBalance);
  document.getElementById("merchantCreateQRBtn").addEventListener("click", createMerchantQR);
  document.getElementById("merchantScanQRBtn").addEventListener("click", merchantScanQR);
  document.getElementById("merchantTransferBtn").addEventListener("click", openMerchantTransferModal);

  // Сразу обновим баланс мерчанта
  fetchMerchantBalance();
}

/**
 * Пример: Получаем баланс мерчанта (ожидается эндпоинт типа /merchantBalance?merchantId=...)
 * и записываем в merchantBalance, отображаем в #merchantBalanceValue
 */
async function fetchMerchantBalance() {
  if (!currentMerchantId) return;
  try {
    const resp = await fetch(`${API_URL}/merchantBalance?merchantId=${currentMerchantId}`);
    const data = await resp.json();
    if (resp.ok && data.success) {
      merchantBalance = parseFloat(data.balance) || 0;
      document.getElementById("merchantBalanceValue").textContent = merchantBalance.toFixed(5);
    } else {
      alert("Ошибка при получении баланса мерчанта: " + (data.error || "Неизвестная ошибка"));
    }
  } catch (err) {
    console.error("Ошибка сети при получении баланса мерчанта:", err);
  }
}

/**
 * Создать QR для приёма платежей. Например, генерируем строку "guga://merchantId=..."
 * и отображаем её в виде QR-кода (используйте библиотеку QRCode, например "qrcodejs")
 */
function createMerchantQR() {
  const container = document.getElementById("merchantQRContainer");
  container.innerHTML = "";

  // Пример строки, которая содержит merchantId:
  const qrData = `guga://merchantId=${currentMerchantId}`;
  
  // Допустим, у вас подключена библиотека qrcode.js
  //   new QRCode(container, {
  //     text: qrData,
  //     width: 128,
  //     height: 128,
  //   });

  // Если без библиотеки, просто отображаем текст:
  const p = document.createElement("p");
  p.textContent = `QR Data: ${qrData} (для генерации реального QR подключите QR-библиотеку)`;
  container.appendChild(p);
}

/**
 * Мерчант также может "сканировать" QR (например, для возвратов или взаиморасчётов).
 * Можно переиспользовать ту же логику startQRScanner, что и для пользователя.
 */
function merchantScanQR() {
  createModal("merchantScanQRModal", `
    <h3>Сканирование QR</h3>
    <div style="display:flex;flex-direction:column;align-items:center;">
      <video id="merchantScanVideo" style="width:100%;max-width:400px;border:1px solid #000;" autoplay muted playsinline></video>
      <p>Наведите камеру на QR</p>
    </div>
  `);
  openModal("merchantScanQRModal");
  startQRScanner("merchantScanVideo");
}

/**
 * Модальное окно "Перевести" (мерчант -> пользователь).
 * Ожидается, что на сервере есть эндпоинт /merchantTransfer (пример).
 */
function openMerchantTransferModal() {
  createModal("merchantTransferModal", `
    <h3>Перевести на пользователя</h3>
    <div style="display:flex;flex-direction:column;align-items:center;">
      <label>Кому (userId):</label>
      <input type="text" id="merchantToUserIdInput" placeholder="Введите ID пользователя">
      <label>Сумма (₲):</label>
      <input type="number" id="merchantTransferAmountInput" step="0.00001" placeholder="Сумма">
      <button id="merchantTransferSendBtn">Отправить</button>
    </div>
  `);
  openModal("merchantTransferModal");

  document.getElementById("merchantTransferSendBtn").onclick = async () => {
    const toUser = document.getElementById("merchantToUserIdInput")?.value;
    const amt = parseFloat(document.getElementById("merchantTransferAmountInput")?.value);
    if (!toUser || !amt || amt <= 0) {
      alert("Введите корректные данные");
      return;
    }
    await merchantTransfer(toUser, amt);
  };
}

/**
 * Пример запроса (merchant -> user)
 * Ожидается эндпоинт /merchantTransfer на сервере.
 */
async function merchantTransfer(toUserId, amount) {
  try {
    const resp = await fetch(`${API_URL}/merchantTransfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchantId: currentMerchantId,
        toUserId,
        amount
      })
    });
    const data = await resp.json();
    if (resp.ok && data.success) {
      alert("Перевод выполнен!");
      document.getElementById("merchantTransferModal")?.remove();
      // Обновляем баланс мерчанта
      fetchMerchantBalance();
    } else {
      alert("Ошибка перевода мерчант->пользователь: " + (data.error || "Неизвестная ошибка"));
    }
  } catch (err) {
    console.error("Ошибка сети при merchantTransfer:", err);
  }
}

/* ================================
   МАЙНИНГ ДЛЯ ПОЛЬЗОВАТЕЛЯ
================================ */
function mineCoins() {
  if (!currentUserId) return;
  clearInterval(updateInterval);
  isMining = true;

  pendingMinedCoins = parseFloat((pendingMinedCoins + 0.00001).toFixed(5));
  localStorage.setItem("pendingMinedCoins", pendingMinedCoins);
  localBalance = parseFloat((localBalance + 0.00001).toFixed(5));
  updateBalanceUI();

  if (mineTimer) clearTimeout(mineTimer);
  mineTimer = setTimeout(() => {
    isMining = false;
    flushMinedCoins();
    updateInterval = setInterval(fetchUserData, 2000);
  }, 1500);
}

async function flushMinedCoins() {
  if (!currentUserId || pendingMinedCoins <= 0) return;
  try {
    const resp = await fetch(`${API_URL}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUserId, amount: pendingMinedCoins })
    });
    if (!resp.ok) throw new Error(`Сервер ответил статусом ${resp.status}`);
    pendingMinedCoins = 0;
    localStorage.removeItem("pendingMinedCoins");
    fetchUserData();
  } catch (err) {
    console.error("Ошибка при отправке намайненных монет:", err);
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
  } catch (err) {
    console.error("Ошибка при sync отправке:", err);
  }
}

function updateBalanceUI() {
  const balanceValue = document.getElementById("balanceValue");
  if (balanceValue) balanceValue.textContent = formatBalance(localBalance);
}

function formatBalance(balance) {
  return parseFloat(balance).toFixed(5);
}

/* ================================
   ПОЛУЧЕНИЕ ДАННЫХ ПОЛЬЗОВАТЕЛЯ
================================ */
async function fetchUserData() {
  if (isMining) return;
  if (!currentUserId) return;
  try {
    const resp = await fetch(`${API_URL}/user?userId=${currentUserId}`);
    if (!resp.ok) throw new Error(`Сервер ответил статусом ${resp.status}`);
    const data = await resp.json();
    if (data.success && data.user) {
      if (data.user.blocked === 1) {
        alert("Учётная запись заблокирована");
        logout();
        return;
      }
      localBalance = parseFloat(data.user.balance || 0);
      updateBalanceUI();
      updateExchangeModalInfo(data.user);
    }
  } catch (err) {
    console.error("Ошибка fetchUserData:", err);
  }
}

/* ================================
   ИСТОРИЯ ОПЕРАЦИЙ
================================ */
function openHistoryModal() {
  createModal("historyModal", `
    <h3>История операций</h3>
    <div class="scrollable-content">
      <ul id="transactionList"></ul>
    </div>
  `);
  openModal("historyModal");
  fetchTransactionHistory();
}

async function fetchTransactionHistory() {
  if (!currentUserId) return;
  try {
    const resp = await fetch(`${API_URL}/transactions?userId=${currentUserId}`);
    if (!resp.ok) throw new Error(`Сервер ответил статусом ${resp.status}`);
    const data = await resp.json();
    if (data.success && data.transactions) {
      displayTransactionHistory(data.transactions);
    }
  } catch (err) {
    console.error("Ошибка при получении истории:", err);
  }
}

function getDateLabel(dateObj) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dateObj.toDateString() === today.toDateString()) return "Сегодня";
  if (dateObj.toDateString() === yesterday.toDateString()) return "Вчера";
  return dateObj.toLocaleDateString("ru-RU");
}

function displayTransactionHistory(transactions) {
  const container = document.getElementById("transactionList");
  if (!container) return;

  container.innerHTML = "";
  if (!transactions.length) {
    container.innerHTML = "<li>Нет операций</li>";
    return;
  }

  const grouped = {};
  transactions.forEach(tx => {
    const d = new Date(tx.created_at);
    const label = getDateLabel(d);
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(tx);
  });

  const sortedDates = Object.keys(grouped).sort((a, b) => {
    const dateA = new Date(grouped[a][0].created_at);
    const dateB = new Date(grouped[b][0].created_at);
    return dateB - dateA;
  });

  sortedDates.forEach(dateStr => {
    const groupDiv = document.createElement("div");
    groupDiv.className = "history-group";

    const dateHeader = document.createElement("div");
    dateHeader.className = "history-date";
    dateHeader.textContent = dateStr;
    groupDiv.appendChild(dateHeader);

    grouped[dateStr].forEach(tx => {
      const op = document.createElement("div");
      op.className = "history-item";

      let opType = "";
      if (tx.type === "sent") {
        opType = "Исходящая операция ⤴";
      } else if (tx.type === "received") {
        opType = "Входящая операция ⤵";
      } else if (tx.type === "merchant") {
        opType = "Оплата мерчанту";
      }
      const amountStr = `Кол-во: ₲ ${formatBalance(tx.amount)}`;
      const timeStr = new Date(tx.created_at).toLocaleTimeString("ru-RU");
      let detail = "";
      if (tx.type === "sent") {
        detail = `Кому: ${tx.to_user_id}`;
      } else if (tx.type === "received") {
        detail = `От кого: ${tx.from_user_id}`;
      } else if (tx.type === "merchant") {
        detail = `Мерчант: ${tx.merchant_id || "???"}`;
      }

      op.innerHTML = `
        <div>${opType}</div>
        <div>${detail}</div>
        <div>${amountStr}</div>
        <div>${timeStr}</div>
      `;
      groupDiv.appendChild(op);
    });

    container.appendChild(groupDiv);
  });
}

/* ================================
   ОБМЕН
================================ */
function openExchangeModal() {
  createModal("exchangeModal", `
    <h3>Обмен</h3>
    <div style="display:flex;flex-direction:column;align-items:center;">
      <p id="exchangeRateInfo"></p>
      <p id="rubBalanceInfo"></p>
      <p id="halvingLevel"></p>
    </div>
  `);
  openModal("exchangeModal");
  fetchUserData(); // обновим инфу о пользователе, которая включает halving
}

function updateExchangeModalInfo(user) {
  const halvingStep = user.halvingStep || 0;
  const rubMultiplier = 1 + halvingStep * 0.02;
  const rubBalance = (localBalance * rubMultiplier).toFixed(2);
  const exchangeRateInfo = document.getElementById("exchangeRateInfo");
  const rubBalanceInfo = document.getElementById("rubBalanceInfo");
  const halvingLevel = document.getElementById("halvingLevel");
  if (exchangeRateInfo) exchangeRateInfo.textContent = `Курс: 1 ₲ = ${rubMultiplier} ₽`;
  if (rubBalanceInfo) rubBalanceInfo.textContent = `Баланс: ${rubBalance} ₽`;
  if (halvingLevel) halvingLevel.textContent = `Уровень халвинга: ${halvingStep}`;
}

/* ================================
   СКАНИРОВАНИЕ QR (ПОЛЬЗОВАТЕЛЬ/МЕРЧАНТ)
================================ */
// Общая функция: startQRScanner(videoElId) уже есть выше.
// merchantScanQR() / openMerchantPayModal() — тоже примеры выше.

function stopVideoStream(video) {
  const stream = video.srcObject;
  if (!stream) return;
  stream.getTracks().forEach(track => track.stop());
  video.srcObject = null;
}
function parseMerchantIdFromQR(rawValue) {
  const m = rawValue.match(/merchantId=(\d+)/);
  return m ? m[1] : null;
}

/* ================================
   СТАРТ ПРИ ЗАГРУЗКЕ
================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (pendingMinedCoins > 0) {
    flushMinedCoins();
  }

  const savedUserId = localStorage.getItem("userId");
  if (savedUserId) {
    currentUserId = savedUserId;
    createUI();
    fetchUserData();
  } else {
    openAuthModal();
  }
});

window.addEventListener("beforeunload", () => {
  if (pendingMinedCoins > 0) {
    flushMinedCoinsSync();
  }
});

// Кнопка майнинга
document.getElementById("mineBtn")?.addEventListener("click", mineCoins);

// Экспортируем функции, если нужно
window.sendTransfer = sendTransfer;

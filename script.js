/* ================================
   ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ / НАСТРОЙКИ
================================ */
const API_URL = "https://mkntw-github-io.onrender.com"; // Укажите ваш backend-сервер

// Идентификаторы
let currentUserId = null;      // если вошли как пользователь
let currentMerchantId = null;  // если вошли как мерчант

// Майнинг
let pendingMinedCoins = parseFloat(localStorage.getItem("pendingMinedCoins")) || 0;
let isMining = false;
let mineTimer = null;
let localBalance = 0;

// Интервалы обновления
let updateInterval = null;

// ================================
// ФУНКЦИИ РАБОТЫ С UI
// ================================

/**
 * Выход из системы:
 * - Сбрасываем currentUserId и currentMerchantId
 * - Удаляем UI (topBar/bottomBar/merchantUI)
 * - Показываем окно авторизации
 */
function logout() {
  localStorage.removeItem("userId");
  currentUserId = null;
  currentMerchantId = null;

  // Удаляем topBar, bottomBar, элементы баланса и майнинга
  const topBar = document.getElementById("topBar");
  if (topBar) topBar.remove();
  const bottomBar = document.getElementById("bottomBar");
  if (bottomBar) bottomBar.remove();
  document.getElementById("balanceDisplay")?.classList.add("hidden");
  document.getElementById("mineContainer")?.classList.add("hidden");

  // Если был интерфейс мерчанта – удаляем
  document.getElementById("merchantInterface")?.remove();

  closeAllModals();
  clearInterval(updateInterval);

  // Сбрасываем UI
  const userIdDisplay = document.getElementById("userIdDisplay");
  if (userIdDisplay) userIdDisplay.textContent = "";

  // Показываем окно авторизации
  openAuthModal();
}

function closeAllModals() {
  document.querySelectorAll(".modal").forEach(modal => modal.classList.add("hidden"));
}

/**
 * Создаём или получаем модал. Закрытие по overlay для
 * некоторых типов модалок (paymentModal, historyModal, exchangeModal)
 */
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

  // Закрытие по клику на оверлей
  const modalsWithOverlayClickClose = ["paymentModal", "historyModal", "exchangeModal", "merchantPayModal", "confirmMerchantPaymentModal"];
  if (modalsWithOverlayClickClose.includes(id)) {
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
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("hidden");
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add("hidden");
}

/* ================================
   МОДАЛЬНОЕ ОКНО АВТОРИЗАЦИИ
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

    // Обработчики
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
  // При открытии по умолчанию показываем форму логина
  document.getElementById("loginSection").style.display = "block";
  document.getElementById("registerSection").style.display = "none";
  authModal.classList.remove("hidden");
}

/**
 * Скрываем пользовательский UI (topBar, bottomBar, balance, mineBtn)
 */
function hideMainUI() {
  document.getElementById("topBar")?.classList.add("hidden");
  document.getElementById("bottomBar")?.classList.add("hidden");
  document.getElementById("balanceDisplay")?.classList.add("hidden");
  document.getElementById("mineContainer")?.classList.add("hidden");
  clearInterval(updateInterval);
}

/**
 * Показываем пользовательский UI:
 * - topBar
 * - bottomBar
 * - balanceDisplay
 * - mineContainer
 */
function showMainUI() {
  // topBar
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

  // bottomBar
  if (!document.getElementById("bottomBar")) {
    const bottomBar = document.createElement("div");
    bottomBar.id = "bottomBar";
    bottomBar.innerHTML = `
      <button id="paymentBtn">Перевести</button>
      <button id="historyBtn">История</button>
      <button id="exchangeBtn">Обменять</button>
      <!-- Пример кнопки оплаты мерчанту -->
      <button id="merchantPayBtn">Оплатить мерчанту</button>
    `;
    document.body.appendChild(bottomBar);

    document.getElementById("paymentBtn").addEventListener("click", openPaymentModal);
    document.getElementById("historyBtn").addEventListener("click", openHistoryModal);
    document.getElementById("exchangeBtn").addEventListener("click", openExchangeModal);
    // Оплата мерчанту (QR)
    document.getElementById("merchantPayBtn").addEventListener("click", openMerchantPayModal);
  }
  document.getElementById("bottomBar").classList.remove("hidden");

  // Показываем блок баланса и майнинга
  document.getElementById("balanceDisplay")?.classList.remove("hidden");
  document.getElementById("mineContainer")?.classList.remove("hidden");

  // Запускаем автообновление данных
  updateInterval = setInterval(fetchUserData, 2000);
}

function updateTopBar() {
  const userIdDisplay = document.getElementById("userIdDisplay");
  if (userIdDisplay) {
    userIdDisplay.textContent = currentUserId ? `ID: ${currentUserId}` : "";
  }
}

/* ================================
   ЛОГИКА: ПОЛЬЗОВАТЕЛЬ vs. МЕРЧАНТ
================================ */

/**
 * Логин с одной формы:
 *  1) /login (пользователь)
 *  2) при ошибке — /merchantLogin
 *  3) если успех => userId или merchantId
 */
async function login() {
  const loginVal = document.getElementById("loginInput")?.value;
  const passwordVal = document.getElementById("passwordInput")?.value;
  if (!loginVal || !passwordVal) {
    alert("Введите логин и пароль");
    return;
  }

  try {
    // 1) Пробуем как пользователь
    let resp = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: loginVal, password: passwordVal })
    });
    let data = await resp.json();

    if (resp.ok && data.success) {
      // Успех: пользователь
      currentUserId = data.userId;
      localStorage.setItem("userId", currentUserId);
      // Показываем пользовательский UI
      closeModal("authModal");
      createUI();    // Создаёт topBar + bottomBar (если нужно)
      updateUI();    // Показываем всё
      fetchUserData();
      return;
    } else {
      // 2) Пробуем мерчанта
      console.log("Пользователь не подошёл:", data.error);
      resp = await fetch(`${API_URL}/merchantLogin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginVal, password: passwordVal })
      });
      data = await resp.json();
      if (resp.ok && data.success) {
        // Успех: мерчант
        currentMerchantId = data.merchantId;
        closeModal("authModal");
        // Открываем интерфейс мерчанта
        openMerchantUI();
      } else {
        console.error("Мерчант тоже не подошёл:", data.error);
        alert("Ошибка входа: " + data.error);
      }
    }
  } catch (err) {
    console.error("Ошибка сети при логине:", err);
    alert("Ошибка сети");
  }
}

/**
 * Регистрация (только пользователь)
 */
async function register() {
  const loginVal = document.getElementById("regLogin")?.value;
  const passwordVal = document.getElementById("regPassword")?.value;
  if (!loginVal || !passwordVal) {
    alert("Введите логин и пароль");
    return;
  }
  try {
    const resp = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: loginVal, password: passwordVal })
    });
    const data = await resp.json();
    if (resp.ok && data.success) {
      alert(`Аккаунт создан! Ваш userId: ${data.userId}`);
      currentUserId = data.userId;
      localStorage.setItem("userId", currentUserId);
      closeModal("authModal");
      createUI();
      updateUI();
      fetchUserData();
    } else {
      alert("Ошибка регистрации: " + data.error);
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
  // Если нужно создать элементы topBar/bottomBar, делаем это один раз
  showMainUI(); // Показываем UI и запускаем updateInterval
}

/**
 * Обновляет пользовательский UI (если userId есть),
 * иначе скрывает всё и показывает окно авторизации
 */
function updateUI() {
  if (currentUserId) {
    updateTopBar();
    showMainUI();
  } else {
    hideMainUI();
    openAuthModal();
  }
}

/* ================================
   UI ДЛЯ МЕРЧАНТА (простейший пример)
================================ */
function openMerchantUI() {
  hideMainUI();
  closeAllModals();

  // Удаляем старый интерфейс, если есть
  document.getElementById("merchantInterface")?.remove();

  // Создаём блок
  const merchDiv = document.createElement("div");
  merchDiv.id = "merchantInterface";
  merchDiv.style.textAlign = "center";
  merchDiv.style.marginTop = "100px";
  merchDiv.innerHTML = `
    <h1>Merchant Dashboard</h1>
    <p>Merchant ID: <strong>${currentMerchantId}</strong></p>
    <p>Здесь можно показывать функционал мерчанта (генерация QR, просмотр платежей и т.д.)</p>
    <button onclick="logout()">Выйти</button>
  `;
  document.body.appendChild(merchDiv);
}

/* ================================
   ФУНКЦИИ ДОБЫЧИ (МАЙНИНГ)
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
  // При закрытии вкладки
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
   РАБОТА С СЕРВЕРОМ (ПОЛУЧЕНИЕ ДАННЫХ)
================================ */
async function fetchUserData() {
  if (isMining) return;
  if (!currentUserId) return;
  try {
    const resp = await fetch(`${API_URL}/user?userId=${currentUserId}`);
    if (!resp.ok) throw new Error(`Сервер ответил статусом ${resp.status}`);
    const data = await resp.json();
    if (data.success && data.user) {
      // Если user.blocked = 1
      if (data.user.blocked === 1) {
        alert("Ваш аккаунт заблокирован");
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
   МОДАЛЬНЫЕ ОКНА: ПЕРЕВОД, ИСТОРИЯ, ОБМЕН
================================ */
function openPaymentModal() {
  const content = `
    <h3>Перевести</h3>
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
      <label for="toUserIdInput">Кому (ID):</label>
      <input type="text" id="toUserIdInput" placeholder="Введите ID получателя">
      <label for="transferAmountInput">Сумма:</label>
      <input type="number" id="transferAmountInput" step="0.00001" placeholder="Введите сумму">
      <button id="sendTransferBtn">Отправить</button>
    </div>
  `;
  createModal("paymentModal", content);
  openModal("paymentModal");

  document.getElementById("sendTransferBtn").onclick = async () => {
    await sendTransfer();
  };
}

async function sendTransfer() {
  const toUserId = document.getElementById("toUserIdInput")?.value;
  const amount = parseFloat(document.getElementById("transferAmountInput")?.value);
  if (!toUserId || !amount || amount <= 0) {
    alert("Некорректные данные");
    return;
  }
  if (toUserId === currentUserId) {
    alert("Нельзя перевести самому себе");
    return;
  }
  try {
    const resp = await fetch(`${API_URL}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromUserId: currentUserId, toUserId, amount })
    });
    const data = await resp.json();
    if (data.success) {
      alert("Перевод выполнен!");
      closeModal("paymentModal");
      fetchUserData();
    } else {
      alert("Ошибка перевода: " + data.error);
    }
  } catch (err) {
    console.error("Ошибка при переводе:", err);
  }
}

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

/**
 * Отображение истории:
 * - разбиваем по датам
 * - тип операции (sent, received, merchant)
 */
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
    // берем первую транзакцию и сравниваем по времени
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
  // Обновляем userData, чтобы отобразить актуальный halvingStep
  fetchUserData();
}

function updateExchangeModalInfo(user) {
  const halvingStep = user.halvingStep || 0;
  const rubMultiplier = 1 + halvingStep * 0.02;
  const rubBalance = (localBalance * rubMultiplier).toFixed(2);
  const exchangeRateInfo = document.getElementById("exchangeRateInfo");
  const rubBalanceInfo = document.getElementById("rubBalanceInfo");
  const halvingLevel = document.getElementById("halvingLevel");
  if (exchangeRateInfo) {
    exchangeRateInfo.textContent = `Курс: 1 ₲ = ${rubMultiplier} ₽`;
  }
  if (rubBalanceInfo) {
    rubBalanceInfo.textContent = `Баланс: ${rubBalance} ₽`;
  }
  if (halvingLevel) {
    halvingLevel.textContent = `Уровень халвинга: ${halvingStep}`;
  }
}

/* ================================
   ОПЛАТА МЕРЧАНТУ ЧЕРЕЗ QR (пример)
================================ */
function openMerchantPayModal() {
  // Модальное окно, в котором мы запускаем камеру
  createModal("merchantPayModal", `
    <h3>Сканировать QR мерчанта</h3>
    <div style="display:flex;flex-direction:column;align-items:center;">
      <video id="merchantPayVideo" style="width:100%;max-width:400px;border:1px solid #000;" autoplay muted playsinline></video>
      <p>Наведите камеру на QR</p>
    </div>
  `);
  openModal("merchantPayModal");
  startQRScanner("merchantPayVideo");
}

// Запуск сканирования (упрощённо, используя BarcodeDetector)
async function startQRScanner(videoElId) {
  const video = document.getElementById(videoElId);
  if (!video) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = stream;
    video.play();

    if (!('BarcodeDetector' in window)) {
      console.log("BarcodeDetector не поддерживается, используйте другую библиотеку.");
      return;
    }
    const detector = new BarcodeDetector({ formats: ['qr_code'] });

    const scan = async () => {
      try {
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0) {
          const rawValue = barcodes[0].rawValue;
          console.log("QR detected:", rawValue);
          stopVideoStream(video);
          document.getElementById("merchantPayModal")?.remove();
          // Извлекаем merchantId
          const merchantId = parseMerchantIdFromQR(rawValue);
          if (!merchantId) {
            alert("Не удалось извлечь merchantId из QR");
            return;
          }
          openConfirmMerchantPaymentModal(merchantId);
        } else {
          requestAnimationFrame(scan);
        }
      } catch (err) {
        console.error("Ошибка при detect:", err);
        requestAnimationFrame(scan);
      }
    };
    requestAnimationFrame(scan);

  } catch (err) {
    console.error("Ошибка доступа к камере:", err);
    alert("Невозможно открыть камеру");
  }
}

function stopVideoStream(video) {
  const stream = video.srcObject;
  if (!stream) return;
  stream.getTracks().forEach(track => track.stop());
  video.srcObject = null;
}

// Простейший разбор строки QR. Предположим, что там что-то вроде "guga://merchantId=123456"
function parseMerchantIdFromQR(rawValue) {
  const m = rawValue.match(/merchantId=(\d+)/);
  return m ? m[1] : null;
}

// Окно, где вводим сумму и назначение платежа мерчанту
function openConfirmMerchantPaymentModal(merchantId) {
  createModal("confirmMerchantPaymentModal", `
    <h3>Оплата мерчанту ${merchantId}</h3>
    <div style="display:flex;flex-direction:column;align-items:center;">
      <label>Сумма (₲):</label>
      <input type="number" id="merchantPayAmountInput" step="0.00001" placeholder="Введите сумму">
      <label>Назначение платежа:</label>
      <input type="text" id="merchantPayPurposeInput" placeholder="Например, товар #123">
      <button id="merchantPaySendBtn">Отправить</button>
    </div>
  `);
  openModal("confirmMerchantPaymentModal");

  document.getElementById("merchantPaySendBtn").onclick = () => {
    const amount = parseFloat(document.getElementById("merchantPayAmountInput")?.value);
    const purpose = document.getElementById("merchantPayPurposeInput")?.value || "";
    payMerchant(merchantId, amount, purpose);
  };
}

// Пример отправки на эндпоинт /payMerchant
async function payMerchant(merchantId, amount, purpose) {
  if (!currentUserId || !merchantId || !amount || amount <= 0) {
    alert("Некорректные данные для оплаты");
    return;
  }
  try {
    const resp = await fetch(`${API_URL}/payMerchant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: currentUserId,
        merchantId,
        amount,
        purpose
      })
    });
    const data = await resp.json();
    if (data.success) {
      alert("Оплата успешна!");
      document.getElementById("confirmMerchantPaymentModal")?.remove();
      fetchUserData();
    } else {
      alert("Ошибка оплаты мерчанту: " + data.error);
    }
  } catch (err) {
    console.error("Ошибка оплаты мерчанту:", err);
  }
}

/* ================================
   СТАРТ ПРИ ЗАГРУЗКЕ
================================ */
document.addEventListener("DOMContentLoaded", () => {
  // Если есть накопленные монеты, сразу отправляем
  if (pendingMinedCoins > 0) {
    flushMinedCoins();
  }

  // Проверяем, не сохранён ли userId
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

// При выгрузке вкладки, отправляем накопленные монеты синхронно
window.addEventListener("beforeunload", () => {
  if (pendingMinedCoins > 0) {
    flushMinedCoinsSync();
  }
});

// Кнопка майнинга (если есть в HTML)
document.getElementById("mineBtn")?.addEventListener("click", mineCoins);

// Экспортируем функцию (если нужно)
window.sendTransfer = sendTransfer;

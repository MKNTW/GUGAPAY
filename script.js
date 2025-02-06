/* ================================
   ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ / НАСТРОЙКИ
================================ */
const API_URL = "https://mkntw-github-io.onrender.com"; // Укажите ваш backend-сервер

let currentUserId = null;      // если вошли как пользователь
let currentMerchantId = null;  // если вошли как мерчант

// Майнинг (для пользователей)
let pendingMinedCoins = parseFloat(localStorage.getItem("pendingMinedCoins")) || 0;
let isMining = false;
let mineTimer = null;
let localBalance = 0; // баланс пользователя

// Баланс мерчанта (если хотим отображать на мерчант-стороне)
let merchantBalance = 0; 

// Интервалы для автообновления
let updateInterval = null;

/* ================================
   ВХОД / РЕГИСТРАЦИЯ / ВЫХОД
================================ */
async function login() {
  const loginVal = document.getElementById("loginInput")?.value;
  const passVal = document.getElementById("passwordInput")?.value;
  if (!loginVal || !passVal) {
    alert("Введите логин и пароль");
    return;
  }

  try {
    // (A) Пробуем логин как пользователь
    let response = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: loginVal, password: passVal })
    });
    let data = await response.json();

    if (response.ok && data.success) {
      // Успешно вошли как пользователь
      currentUserId = data.userId;
      localStorage.setItem("userId", currentUserId);
      document.getElementById("authModal")?.remove(); // Удаляем окно авторизации
      createUI();
      updateUI();
      fetchUserData();
    } else {
      // (B) Неуспех для пользователя: пробуем мерчанта
      if (data.error?.includes("блокирован")) {
        alert("Ваш аккаунт заблокирован");
        return;
      }
      const merchResp = await fetch(`${API_URL}/merchantLogin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginVal, password: passVal })
      });
      const merchData = await merchResp.json();
      if (merchResp.ok && merchData.success) {
        // Успешный вход как мерчант
        currentMerchantId = merchData.merchantId;
        document.getElementById("authModal")?.remove();
        openMerchantUI();
      } else {
        if (merchData.error?.includes("блокирован")) {
          alert("Ваш аккаунт заблокирован");
        } else {
          alert(`❌ Ошибка входа: ${merchData.error}`);
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
      alert(`✅ Аккаунт создан! Ваш userId: ${data.userId}`);
      currentUserId = data.userId;
      localStorage.setItem("userId", currentUserId);

      document.getElementById("authModal")?.remove();
      createUI();
      updateUI();
      fetchUserData();
    } else {
      if (data.error?.includes("блокирован")) {
        alert("Ваш аккаунт заблокирован");
      } else {
        alert(`❌ Ошибка входа: ${data.error}`);
      }
    }
  } catch (err) {
    console.error("Ошибка сети при регистрации:", err);
    alert("Ошибка сети при регистрации");
  }
}

function logout() {
  localStorage.removeItem("userId");
  currentUserId = null;
  currentMerchantId = null;

  document.getElementById("topBar")?.remove();
  document.getElementById("bottomBar")?.remove();
  document.getElementById("balanceDisplay")?.classList.add("hidden");
  document.getElementById("mineContainer")?.classList.add("hidden");
  document.getElementById("merchantInterface")?.remove();

  closeAllModals();
  clearInterval(updateInterval);

  openAuthModal();
}

/* ================================
   АВТОРИЗАЦИЯ (МОДАЛЬНОЕ ОКНО)
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

/* ================================
   UI ПОЛЬЗОВАТЕЛЯ (ПЕРВОНАЧАЛЬНЫЙ)
================================ */
function createUI() {
  showMainUI();
}

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
      <button id="merchantPayBtn">Оплатить</button>
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

function hideMainUI() {
  document.getElementById("topBar")?.classList.add("hidden");
  document.getElementById("bottomBar")?.classList.add("hidden");
  document.getElementById("balanceDisplay")?.classList.add("hidden");
  document.getElementById("mineContainer")?.classList.add("hidden");
  clearInterval(updateInterval);
}

/* ================================
   UI МЕРЧАНТА (БЕЗ SCAN QR / REFRESH)
================================ */
function openMerchantUI() {
  hideMainUI();
  closeAllModals();
  document.getElementById("merchantInterface")?.remove();

  const merchDiv = document.createElement("div");
  merchDiv.id = "merchantInterface";
  merchDiv.style.textAlign = "center";
  merchDiv.style.marginTop = "70px";
  merchDiv.innerHTML = `
    <h1>Merchant Dashboard</h1>
    <p>Merchant ID: <strong>${currentMerchantId}</strong></p>
    <p>Баланс мерчанта: <span id="merchantBalanceValue">0.00000</span> ₲</p>

    <button id="merchantCreateQRBtn">Создать одноразовый QR</button>
    <button id="merchantTransferBtn" style="margin-left:10px;">Перевести на пользователя</button>

    <div id="merchantQRContainer" style="margin-top:20px;"></div>

    <button style="margin-top:30px;" onclick="logout()">Выйти</button>
  `;
  document.body.appendChild(merchDiv);

  document.getElementById("merchantCreateQRBtn").addEventListener("click", openOneTimeQRModal);
  document.getElementById("merchantTransferBtn").addEventListener("click", openMerchantTransferModal);

  fetchMerchantBalance();
}

// --- Модальное окно: ввести сумму/назначение, сгенерировать QR ---
function openOneTimeQRModal() {
  createModal("createOneTimeQRModal", `
    <h3>Создать запрос на оплату</h3>
    <div style="display:flex;flex-direction:column;align-items:center;">
      <label>Сумма (₲):</label>
      <input type="number" id="qrAmountInput" step="0.00001" placeholder="Введите сумму">
      <label>Назначение:</label>
      <input type="text" id="qrPurposeInput" placeholder="Например, заказ #123">
      <button id="createQRBtn">Создать</button>
    </div>
  `);
  openModal("createOneTimeQRModal");

  document.getElementById("createQRBtn").onclick = () => {
    const amountVal = parseFloat(document.getElementById("qrAmountInput")?.value);
    const purposeVal = document.getElementById("qrPurposeInput")?.value || "";
    if (!amountVal || amountVal <= 0) {
      alert("Введите корректную сумму");
      return;
    }
    closeModal("createOneTimeQRModal");
    createMerchantQR(amountVal, purposeVal);
  };
}

// --- Генерация реального QR через qrcodejs (если библиотека подключена) ---
function createMerchantQR(amount, purpose) {
  const container = document.getElementById("merchantQRContainer");
  container.innerHTML = "";

  // Строка вида guga://merchantId=XXXX&amount=YYY&purpose=ZZZ
  const qrData = `guga://merchantId=${currentMerchantId}&amount=${amount}&purpose=${encodeURIComponent(purpose)}`;

  if (typeof QRCode === "function") {
    const qrElem = document.createElement("div");
    container.appendChild(qrElem);
    new QRCode(qrElem, {
      text: qrData,
      width: 128,
      height: 128
    });
  } else {
    container.innerHTML = `QR Data (нет qrcode.js): ${qrData}`;
  }
}

// --- Запрос баланса мерчанта ---
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

// --- Модальное окно для перевода мерчант->пользователь ---
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
 * Перевод мерчант->пользователь (эндпоинт /merchantTransfer).
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
      fetchMerchantBalance();
    } else {
      alert("Ошибка перевода мерчант->пользователь: " + (data.error || "Неизвестная ошибка"));
    }
  } catch (err) {
    console.error("Ошибка сети при merchantTransfer:", err);
  }
}

/* ================================
   ОПЛАТА MERCHANT QR (ПОЛЬЗОВАТЕЛЬ)
   Сканирование
================================ */
function openMerchantPayModal() {
  createModal("merchantPayModal", `
    <h3>Сканировать QR</h3>
    <div style="display:flex;flex-direction:column;align-items:center;">
      <video id="merchantPayVideo" style="width:100%;max-width:400px;border:1px solid #000;" autoplay muted playsinline></video>
      <p>Наведите камеру на QR</p>
    </div>
  `);
  openModal("merchantPayModal");
  startQRScanner("merchantPayVideo");
}

// Пример функции сканирования камеры при открытии окна оплаты мерчанту
function startQRScanner(videoElId) {
  const video = document.getElementById(videoElId);
  if (!video) return;

  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then(stream => {
      video.srcObject = stream;
      video.play();

      if (!('BarcodeDetector' in window)) {
        console.log("BarcodeDetector не поддерживается, используйте другую библиотеку (jsQR, zxing).");
        return;
      }
      const detector = new BarcodeDetector({ formats: ['qr_code'] });

      // Функция рекурсивного сканирования
      const scan = async () => {
        try {
          const barcodes = await detector.detect(video);
          if (barcodes.length > 0) {
            // Как только QR найден, останавливаем стрим...
            stopVideoStream(video);

            // ...закрываем окно, где был <video> (merchantPayModal)...
            document.getElementById("merchantPayModal")?.remove();

            // ...и разбираем строку QR
            const rawValue = barcodes[0].rawValue;
            console.log("QR detected:", rawValue);

            // Допустим, вы создаёте функцию parseMerchantQRData, 
            // которая возвращает объект { merchantId, amount, purpose }
            const parsed = parseMerchantQRData(rawValue);
            if (!parsed.merchantId) {
              alert("Не удалось извлечь merchantId");
              return;
            }

            // Открываем окно подтверждения с суммой и назначением платежа
            openConfirmMerchantPaymentModal(parsed);
          } else {
            // Если ничего не нашли — продолжаем сканировать
            requestAnimationFrame(scan);
          }
        } catch (err) {
          console.error("Ошибка при detect:", err);
          requestAnimationFrame(scan);
        }
      };
      // Запускаем цикл
      requestAnimationFrame(scan);

    })
    .catch(err => {
      console.error("Ошибка доступа к камере:", err);
      alert("Невозможно открыть камеру");
    });
}

// Остановка стрима (полностью)
function stopVideoStream(video) {
  const stream = video.srcObject;
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
  video.srcObject = null;
}

function parseMerchantQRData(rawValue) {
  // guga://merchantId=XXXX&amount=YYY&purpose=ZZZ
  const merchantIdMatch = rawValue.match(/merchantId=(\d+)/);
  const amountMatch = rawValue.match(/amount=([\d\.]+)/);
  const purposeMatch = rawValue.match(/purpose=([^&]+)/);

  const merchantId = merchantIdMatch ? merchantIdMatch[1] : "";
  const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;
  const purpose = purposeMatch ? decodeURIComponent(purposeMatch[1]) : "";

  return { merchantId, amount, purpose };
}

function openConfirmMerchantPaymentModal({ merchantId, amount, purpose }) {
  createModal("confirmMerchantPaymentModal", `
    <h3>Оплата мерчанту ${merchantId}</h3>
    <p>Сумма: ${amount} ₲</p>
    <p>Назначение: ${purpose}</p>
    <button id="merchantPaySendBtn">Оплатить</button>
  `);
  openModal("confirmMerchantPaymentModal");

  document.getElementById("merchantPaySendBtn").onclick = () => {
    payMerchantOneTime(merchantId, amount, purpose);
  };
}

/**
 * Вычитаем 100% у пользователя, 95% зачисляем мерчанту.
 * Новый эндпоинт: /payMerchantOneTime
 */
async function payMerchantOneTime(merchantId, amount, purpose) {
  if (!currentUserId) return;
  try {
    const resp = await fetch(`${API_URL}/payMerchantOneTime`, {
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
      alert(`❌ Ошибка оплаты: ${data.error}`);
    }
  } catch (err) {
    console.error("Ошибка при оплате мерчанту:", err);
    alert("Ошибка при оплате");
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
   ОПЕРАЦИЯ: ПЕРЕВОД ПОЛЬЗОВАТЕЛЯ
================================ */
function openPaymentModal() {
  const modalContent = `
    <h3>Перевести</h3>
    <div id="transferContent" style="display:flex;flex-direction:column;align-items:center;">
      <label for="toUserIdInput">Кому (ID):</label>
      <input type="text" id="toUserIdInput" placeholder="ID получателя">

      <label for="transferAmountInput">Сумма:</label>
      <input type="number" id="transferAmountInput" step="0.00001" placeholder="Введите сумму">

      <button id="sendTransferBtn">Отправить</button>
    </div>
  `;
  createModal("paymentModal", modalContent);
  openModal("paymentModal");

  document.getElementById("sendTransferBtn").onclick = async () => {
    await sendTransfer();
  };
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
      body: JSON.stringify({ fromUserId: currentUserId, toUserId, amount })
    });
    const data = await response.json();
    if (data.success) {
      alert("✅ Перевод выполнен успешно!");
      document.getElementById("paymentModal")?.remove();
      fetchUserData();
    } else {
      alert(`❌ Ошибка перевода: ${data.error}`);
    }
  } catch (error) {
    console.error("Ошибка при переводе:", error);
    alert("🚫 Ошибка сети");
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

function displayTransactionHistory(transactions) {
  const container = document.getElementById("transactionList");
  if (!container) return;

  container.innerHTML = "";
  if (!transactions.length) {
    container.innerHTML = "<li>Нет операций</li>";
    return;
  }

  // Группируем по дате
  const groups = {};
  transactions.forEach(tx => {
    const d = new Date(tx.created_at);
    const label = getDateLabel(d);
    if (!groups[label]) groups[label] = [];
    groups[label].push(tx);
  });

  const sortedDates = Object.keys(groups).sort((a, b) => {
    const dateA = new Date(groups[a][0].created_at);
    const dateB = new Date(groups[b][0].created_at);
    return dateB - dateA;
  });

  sortedDates.forEach(dateStr => {
    const groupDiv = document.createElement("div");
    groupDiv.className = "history-group";

    const dateHeader = document.createElement("div");
    dateHeader.className = "history-date";
    dateHeader.textContent = dateStr;
    groupDiv.appendChild(dateHeader);

    groups[dateStr].forEach(tx => {
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

function getDateLabel(dateObj) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dateObj.toDateString() === today.toDateString()) return "Сегодня";
  if (dateObj.toDateString() === yesterday.toDateString()) return "Вчера";
  return dateObj.toLocaleDateString("ru-RU");
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
   МОДАЛЬНЫЕ/УТИЛИТЫ
================================ */
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

  const closeOnOverlay = ["paymentModal","historyModal","exchangeModal","merchantPayModal","confirmMerchantPaymentModal","merchantTransferModal","createOneTimeQRModal"];
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
   DOMContentLoaded + beforeunload
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

// Если в HTML есть #mineBtn, вешаем обработчик
document.getElementById("mineBtn")?.addEventListener("click", mineCoins);

/* ================================
   ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ / НАСТРОЙКИ
================================ */
const API_URL = "https://mkntw-github-io.onrender.com"; // Ваш backend-сервер

let currentUserId = null;      // вошли как пользователь
let currentMerchantId = null;  // вошли как мерчант

// Майнинг (только для пользователя)
let pendingMinedCoins = parseFloat(localStorage.getItem("pendingMinedCoins")) || 0;
let isMining = false;
let mineTimer = null;
let localBalance = 0; // баланс пользователя

// Баланс мерчанта (отображаем в его кабинете)
let merchantBalance = 0; 

// Интервал автообновления
let updateInterval = null;

/* ======================================
   1) АВТОРИЗАЦИЯ / РЕГИСТРАЦИЯ / ВЫХОД
====================================== */
async function login() {
  const loginVal = document.getElementById("loginInput")?.value;
  const passVal = document.getElementById("passwordInput")?.value;
  if (!loginVal || !passVal) {
    alert("Введите логин и пароль");
    return;
  }

  try {
    // A) Пробуем логин как пользователь
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
      // Удаляем возможную сессию мерчанта (чтобы не было конфликта)
      localStorage.removeItem("merchantId");
      currentMerchantId = null;

      document.getElementById("authModal")?.remove();
      createUI();
      updateUI();
      fetchUserData();
    } else {
      // B) Если пользователь не вошёл -> пробуем мерчанта
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
        // Успешно вошли как мерчант
        currentMerchantId = merchData.merchantId;
        localStorage.setItem("merchantId", currentMerchantId);
        // Удаляем возможную сессию пользователя (чтобы не было конфликта)
        localStorage.removeItem("userId");
        currentUserId = null;

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
    console.error("Сбой при логине:", err);
    // Убрали всплывающий alert
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

      // Если мерчант сохранялся - убираем
      localStorage.removeItem("merchantId");
      currentMerchantId = null;

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
    console.error("Сбой при регистрации:", err);
    // Убрали всплывающий alert
  }
}

function logout() {
  localStorage.removeItem("userId");
  localStorage.removeItem("merchantId");
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

/* =======================================
   2) МОДАЛЬНОЕ ОКНО АВТОРИЗАЦИИ
======================================= */
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

/* ==================================
   3) UI ПОЛЬЗОВАТЕЛЯ (ПЕРВОНАЧАЛЬНЫЙ)
================================== */
function createUI() {
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

/* ====================================
   4) UI МЕРЧАНТА (убран Scan QR/Refresh)
==================================== */
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

/**
 * Модальное окно: 85% ширины экрана, 70% высоты,
 * ввод суммы (в монетах) и назначение,
 * автоматически считаем рубли
 */
function openOneTimeQRModal() {
  createModal("createOneTimeQRModal", `
    <div style="width:85vw; height:70vh; display:flex; flex-direction:column; justify-content:center; align-items:center;">
      <h3>Создать запрос на оплату</h3>
      <label>Сумма (₲):</label>
      <input type="number" id="qrAmountInput" step="0.00001" placeholder="Введите сумму" style="max-width:200px;" oninput="calcRubEquivalent()">
      <p id="qrRubEquivalent" style="margin:5px 0;"></p>
      <label>Назначение:</label>
      <input type="text" id="qrPurposeInput" placeholder="Например, заказ #123" style="max-width:200px;">
      <button id="createQRBtn" style="margin-top:15px;">Создать</button>
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

/**
 * Автоматически считаем рубли по текущему курсу (допустим, 70₽ за 1 монету),
 * либо можно брать halvingStep. Для примера берём const COIN_TO_RUB=70
 */
function calcRubEquivalent() {
  const COIN_TO_RUB = 70; 
  const coinVal = parseFloat(document.getElementById("qrAmountInput")?.value) || 0;
  const rubVal = coinVal * COIN_TO_RUB;
  document.getElementById("qrRubEquivalent").textContent = `~ ${rubVal.toFixed(2)} RUB`;
}

/**
 * Генерация QR в #merchantQRContainer
 */
function createMerchantQR(amount, purpose) {
  const container = document.getElementById("merchantQRContainer");
  container.innerHTML = "";

  // Здесь merchantId может быть чем угодно
  // Так что при сканировании в parseMerchantQRData мы ищем merchantId=([^&]+)
  const qrData = `guga://merchantId=${currentMerchantId}&amount=${amount}&purpose=${encodeURIComponent(purpose)}`;

  if (typeof QRCode === "function") {
    const qrElem = document.createElement("div");
    container.appendChild(qrElem);

    new QRCode(qrElem, {
      text: qrData,
      width: 128,
      height: 128,
      correctLevel: QRCode.CorrectLevel.L, // МАКС. вместимость
      version: 10 // если всё ещё мало, попробуйте 20 или 40
    });
  } else {
    container.textContent = `QR Data (нет qrcode.js): ${qrData}`;
  }
}


/**
 * Запрос баланса мерчанта
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
    console.error("Сбой при fetchMerchantBalance:", err);
  }
}

/**
 * Модальное окно для перевода мерчант->пользователь
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

async function merchantTransfer(toUserId, amount) {
  try {
    const resp = await fetch(`${API_URL}/merchantTransfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchantId: currentMerchantId, toUserId, amount })
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
    console.error("Сбой при merchantTransfer:", err);
  }
}

/* ======================================
   5) УНИВЕРСАЛЬНАЯ ФУНКЦИЯ СКАНИРОВАНИЯ
   (BarcodeDetector + jsQR fallback)
====================================== */
function startUniversalQRScanner(videoEl, onSuccess) {
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
      videoEl.srcObject = stream;
      videoEl.play();

      if ('BarcodeDetector' in window) {
        // 1) BarcodeDetector
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        
        const scanFrame = async () => {
          try {
            const barcodes = await detector.detect(videoEl);
            if (barcodes.length > 0) {
              stopVideoStream(videoEl);
              onSuccess(barcodes[0].rawValue);
            } else {
              requestAnimationFrame(scanFrame);
            }
          } catch (err) {
            console.error('[BarcodeDetector] detect:', err);
            requestAnimationFrame(scanFrame);
          }
        };
        requestAnimationFrame(scanFrame);

      } else {
        // 2) jsQR fallback
        console.log('BarcodeDetector не поддерживается, fallback на jsQR.');

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const scanFrame = () => {
          if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
            canvas.width = videoEl.videoWidth;
            canvas.height = videoEl.videoHeight;
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
            if (code) {
              stopVideoStream(videoEl);
              onSuccess(code.data);
              return;
            }
          }
          requestAnimationFrame(scanFrame);
        };
        requestAnimationFrame(scanFrame);
      }
    })
    .catch(err => {
      console.error('Ошибка доступа к камере:', err);
    });
}

function stopVideoStream(videoEl) {
  const stream = videoEl.srcObject;
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
  videoEl.srcObject = null;
}

/* ======================================
   6) ОПЛАТА MERCHANT QR (ПОЛЬЗОВАТЕЛЬ)
====================================== */
function openMerchantPayModal() {
  // Модальное окно на 85% ширины, 70% высоты, по центру, без рамок
  createModal("merchantPayModal", `
    <div style="width:85vw; height:70vh; display:flex; flex-direction:column; justify-content:center; align-items:center;">
      <video id="merchantPayVideo" muted playsinline style="width:100%; max-width:400px; border:none;"></video>
      <p>Наведите камеру на QR</p>
    </div>
  `);
  openModal("merchantPayModal");

  const videoEl = document.getElementById('merchantPayVideo');
  startUniversalQRScanner(videoEl, (rawValue) => {
    document.getElementById("merchantPayModal")?.remove();

    const parsed = parseMerchantQRData(rawValue);
    if (!parsed.merchantId) {
      alert("Не удалось извлечь merchantId");
      return;
    }
    openConfirmMerchantPaymentModal(parsed);
  });
}

// Парсим строку вида "guga://merchantId=xxx&amount=yyy&purpose=zzz"
function parseMerchantQRData(rawValue) {
  const merchantIdMatch = rawValue.match(/merchantId=([^&]+)/);
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
 * Списание 100% у пользователя, 95% мерчанту
 */
async function payMerchantOneTime(merchantId, amount, purpose) {
  if (!currentUserId) return;
  try {
    const resp = await fetch(`${API_URL}/payMerchantOneTime`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUserId, merchantId, amount, purpose })
    });
    const data = await resp.json();
    if (data.success) {
      alert(`Оплата прошла успешно на сумму ${amount}`);
      document.getElementById("confirmMerchantPaymentModal")?.remove();
      fetchUserData();
    } else {
      alert(`❌ Ошибка оплаты: ${data.error}`);
    }
  } catch (err) {
    console.error("Сбой payMerchantOneTime:", err);
  }
}

/* ==========================================
   7) МАЙНИНГ, ПЕРЕВОД, ИСТОРИЯ, ОБМЕН
   (те же функции, что и в исходном коде)
========================================== */

// === Майнинг (пользователь) ===
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
    console.error("Ошибка flushMinedCoins:", err);
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
    console.error("Ошибка flushMinedCoinsSync:", err);
  }
}

function updateBalanceUI() {
  const balanceValue = document.getElementById("balanceValue");
  if (balanceValue) {
    balanceValue.textContent = formatBalance(localBalance);
  }
}

function formatBalance(bal) {
  return parseFloat(bal).toFixed(5);
}

// === Получение данных пользователя ===
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
      updateTopBar();
    }
  } catch (err) {
    console.error("Сбой fetchUserData:", err);
  }
}

// === Перевод user->user ===
function openPaymentModal() {
  const modalContent = `
    <h3>Перевести</h3>
    <div style="display:flex;flex-direction:column;align-items:center;">
      <label>Кому (ID):</label>
      <input type="text" id="toUserIdInput" placeholder="ID получателя">

      <label>Сумма (₲):</label>
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
  }
}

// === История операций ===
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
    console.error("Ошибка fetchTransactionHistory:", err);
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

// === Обмен (Exchange) ===
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
  if (exchangeRateInfo) exchangeRateInfo.textContent = `Курс: 1 ₲ = ${rubMultiplier} ₽`;
  if (rubBalanceInfo) rubBalanceInfo.textContent = `Баланс: ${rubBalance} ₽`;
  if (halvingLevel) halvingLevel.textContent = `Уровень халвинга: ${halvingStep}`;
}

/* ================================
   СЛУЖЕБНЫЕ ФУНКЦИИ
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

  const closeOnOverlay = [
    "paymentModal","historyModal","exchangeModal",
    "merchantPayModal","confirmMerchantPaymentModal",
    "merchantTransferModal","createOneTimeQRModal"
  ];
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
   СТАРТ ПРИ ЗАГРУЗКЕ
================================ */
document.addEventListener("DOMContentLoaded", () => {
  // Проверяем накопленные монеты
  if (pendingMinedCoins > 0) {
    flushMinedCoins();
  }

  // Проверяем сессию мерчанта
  const savedMerchantId = localStorage.getItem("merchantId");
  if (savedMerchantId) {
    currentMerchantId = savedMerchantId;
    openMerchantUI();
    return;
  }

  // Если не мерчант, смотрим пользователя
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

// Если есть кнопка майнинга (#mineBtn), вешаем обработчик
document.getElementById("mineBtn")?.addEventListener("click", mineCoins);

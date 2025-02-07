/* ================================
   ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
================================ */
const API_URL = "https://mkntw-github-io.onrender.com"; // Ваш backend-сервер

let currentUserId = null;      // вошли как пользователь
let currentMerchantId = null;  // вошли как мерчант

// Майнинг
let pendingMinedCoins = parseFloat(localStorage.getItem("pendingMinedCoins")) || 0;
let isMining = false;
let mineTimer = null;
let localBalance = 0;  // баланс пользователя
let merchantBalance = 0;  // баланс мерчанта

// Интервал автообновления данных (для пользователя)
let updateInterval = null;

/* ================================
   1) ВХОД / РЕГИСТРАЦИЯ / ВЫХОД
================================ */
async function login() {
  const loginVal = document.getElementById("loginInput")?.value;
  const passVal = document.getElementById("passwordInput")?.value;
  if (!loginVal || !passVal) {
    alert("❌ Введите логин и пароль");
    return;
  }
  try {
    // Попытка логина как пользователь
    const userResp = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: loginVal, password: passVal })
    });
    const userData = await userResp.json();
    if (userResp.ok && userData.success) {
      // Успешный вход: пользователь
      currentUserId = userData.userId;
      localStorage.setItem("userId", currentUserId);
      localStorage.removeItem("merchantId");
      currentMerchantId = null;

      document.getElementById("authModal")?.remove();
      createUI();
      updateUI();     // переключаемся в режим user
      fetchUserData();  // грузим баланс
    } else {
      // Иначе пробуем мерчанта
      if (userData.error?.includes("блокирован")) {
        alert("❌ Ваш аккаунт заблокирован");
        return;
      }
      const merchResp = await fetch(`${API_URL}/merchantLogin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginVal, password: passVal })
      });
      const merchData = await merchResp.json();
      if (merchResp.ok && merchData.success) {
        currentMerchantId = merchData.merchantId;
        localStorage.setItem("merchantId", currentMerchantId);
        localStorage.removeItem("userId");
        currentUserId = null;

        document.getElementById("authModal")?.remove();
        openMerchantUI();
      } else {
        if (merchData.error?.includes("блокирован")) {
          alert("❌ Ваш аккаунт заблокирован");
        } else {
          alert(`❌ Ошибка входа: ${merchData.error}`);
        }
      }
    }
  } catch (err) {
    console.error("Сбой при логине:", err);
  }
}

async function register() {
  const loginVal = document.getElementById("regLogin")?.value;
  const passVal = document.getElementById("regPassword")?.value;
  if (!loginVal || !passVal) {
    alert("❌ Введите логин и пароль");
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
      localStorage.removeItem("merchantId");
      currentMerchantId = null;

      document.getElementById("authModal")?.remove();
      createUI();
      updateUI();
      fetchUserData();
    } else {
      if (data.error?.includes("блокирован")) {
        alert("❌ Ваш аккаунт заблокирован");
      } else {
        alert(`❌ Ошибка входа: ${data.error}`);
      }
    }
  } catch (err) {
    console.error("Сбой при регистрации:", err);
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

/* ================================
   2) ОКНО АВТОРИЗАЦИИ
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
   3) UI ПОЛЬЗОВАТЕЛЯ
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
      <button id="operationsBtn">Операции</button>
      <button id="historyBtn">История</button>
      <button id="exchangeBtn">Обменять</button>
    `;
    document.body.appendChild(bottomBar);

    // «Операции»: перевод / оплата по QR
    document.getElementById("operationsBtn").addEventListener("click", openOperationsModal);
    document.getElementById("historyBtn").addEventListener("click", openHistoryModal);
    document.getElementById("exchangeBtn").addEventListener("click", openExchangeModal);
  }
  document.getElementById("bottomBar").classList.remove("hidden");

  // Показываем баланс и майнинг (если есть)
  document.getElementById("balanceDisplay")?.classList.remove("hidden");
  document.getElementById("mineContainer")?.classList.remove("hidden");

  // Запускаем автообновление
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
   4) UI МЕРЧАНТА
================================ */
function openMerchantUI() {
  hideMainUI();
  closeAllModals();
  document.getElementById("merchantInterface")?.remove();

  const merchDiv = document.createElement("div");
  merchDiv.id = "merchantInterface";
  merchDiv.style.display = "flex";
  merchDiv.style.flexDirection = "column";
  merchDiv.style.alignItems = "center";
  merchDiv.style.marginTop = "70px";
  merchDiv.innerHTML = `
    <h1>КАБИНЕТ МЕРЧАНТА</h1>
    <p>Мерчант: <strong>${currentMerchantId}</strong></p>
    <p>Баланс: <span id="merchantBalanceValue">0.00000</span> ₲</p>
    <div style="display:flex; gap:10px; margin-top:20px;">
      <button id="merchantCreateQRBtn">Создать QR</button>
      <button id="merchantTransferBtn">Перевести</button>
      <button id="merchantLogoutBtn">Выйти</button>
    </div>
    <div id="merchantQRContainer" style="margin-top:120px;"></div>
  `;
  document.body.appendChild(merchDiv);

  document.getElementById("merchantCreateQRBtn").addEventListener("click", openOneTimeQRModal);
  document.getElementById("merchantTransferBtn").addEventListener("click", openMerchantTransferModal);
  document.getElementById("merchantLogoutBtn").addEventListener("click", logout);

  fetchMerchantData();
}

/**
 * Подгружаем баланс мерчанта + halvingStep
 */
async function fetchMerchantData() {
  await fetchMerchantBalance();
  try {
    const halvingResp = await fetch(`${API_URL}/halvingInfo`);
    const halvingData = await halvingResp.json();
    if (halvingResp.ok && halvingData.success) {
      currentHalvingStep = halvingData.halvingStep || 0;
    } else {
      console.log("Не удалось получить halvingInfo:", halvingData.error);
    }
  } catch (err) {
    console.log("Ошибка получения halvingInfo:", err);
  }
}

async function fetchMerchantBalance() {
  if (!currentMerchantId) return;
  try {
    const resp = await fetch(`${API_URL}/merchantBalance?merchantId=${currentMerchantId}`);
    const data = await resp.json();
    if (resp.ok && data.success) {
      merchantBalance = parseFloat(data.balance) || 0;
      const mb = document.getElementById("merchantBalanceValue");
      if (mb) mb.textContent = merchantBalance.toFixed(5);
    } else {
      alert("❌ Ошибка при получении баланса мерчанта: " + (data.error || "Неизвестная ошибка"));
    }
  } catch (err) {
    console.error("Сбой fetchMerchantBalance:", err);
  }
}

/**
 * Создать одноразовый QR
 */
function openOneTimeQRModal() {
  createModal("createOneTimeQRModal", `
    <div style="width:85vw; height:70vh; display:flex; flex-direction:column; justify-content:center; align-items:center;">
      <h3>Создать запрос на оплату</h3>
      <label>Сумма (₲):</label>
      <input type="number" id="qrAmountInput" step="0.00001" placeholder="Введите сумму" style="max-width:200px; margin-bottom:5px;" oninput="calcRubEquivalent()">
      <p id="qrRubEquivalent"></p>
      <label>Назначение:</label>
      <input type="text" id="qrPurposeInput" placeholder="Например, заказ #123" style="max-width:200px;">
      <button id="createQRBtn" style="width:100px; height:40px; margin-top:15px;">Создать</button>
    </div>
  `);
  openModal("createOneTimeQRModal");

  document.getElementById("createQRBtn").onclick = () => {
    const amountVal = parseFloat(document.getElementById("qrAmountInput")?.value);
    const purposeVal = document.getElementById("qrPurposeInput")?.value || "";
    if (!amountVal || amountVal <= 0) {
      alert("❌ Введите корректную сумму");
      return;
    }
    closeModal("createOneTimeQRModal");
    createMerchantQR(amountVal, purposeVal);
  };
}

function calcRubEquivalent() {
  const coinVal = parseFloat(document.getElementById("qrAmountInput")?.value) || 0;
  const rubMultiplier = 1 + currentHalvingStep * 0.02;
  const rubVal = coinVal * rubMultiplier;
  document.getElementById("qrRubEquivalent").textContent = `~ ${rubVal.toFixed(2)} RUB`;
}

function createMerchantQR(amount, purpose) {
  const container = document.getElementById("merchantQRContainer");
  container.innerHTML = "";
  const qrData = `guga://merchantId=${currentMerchantId}&amount=${amount}&purpose=${encodeURIComponent(purpose)}`;

  if (typeof QRCode === "function") {
    const qrElem = document.createElement("div");
    container.appendChild(qrElem);
    new QRCode(qrElem, {
      text: qrData,
      width: 280,
      height: 250,
      correctLevel: QRCode.CorrectLevel.L
    });
  } else {
    container.innerHTML = `QR Data (нет qrcode.js): ${qrData}`;
  }
}

/**
 * Перевод мерчант->пользователь
 */
function openMerchantTransferModal() {
  createModal("merchantTransferModal", `
    <div style="width:85vw; height:70vh; display:flex; flex-direction:column; justify-content:center; align-items:center;">
      <h3>Перевести на пользователя</h3>
      <label>Кому (Id):</label>
      <input type="text" id="merchantToUserIdInput" placeholder="Введите ID" style="max-width:200px;">
      <label>Сумма (₲):</label>
      <input type="number" id="merchantTransferAmountInput" step="0.00001" placeholder="Сумма" style="max-width:200px;">
      <button id="merchantTransferSendBtn" style="width:140px; height:40px; margin-top:15px;">Отправить</button>
    </div>
  `);
  openModal("merchantTransferModal");

  document.getElementById("merchantTransferSendBtn").onclick = async () => {
    const toUser = document.getElementById("merchantToUserIdInput")?.value;
    const amt = parseFloat(document.getElementById("merchantTransferAmountInput")?.value);
    if (!toUser || !amt || amt <= 0) {
      alert("❌ Введите корректные данные");
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
      alert("✅ Перевод выполнен!");
      document.getElementById("merchantTransferModal")?.remove();
      fetchMerchantBalance();
    } else {
      alert("❌ Ошибка перевода мерчант->пользователь: " + (data.error || "Неизвестная ошибка"));
    }
  } catch (err) {
    console.error("Сбой merchantTransfer:", err);
  }
}

/* ================================
   5) ОПЕРАЦИИ (ПОЛЬЗОВАТЕЛЬ: ПЕРЕВОД / ОПЛАТА)
================================ */
function openOperationsModal() {
  createModal("operationsModal", `
    <div style="width:90%;max-width:400px;display:flex;flex-direction:column;align-items:center;">
      <h3>Операции</h3>
      <div id="operationsTabs" style="display:flex;gap:10px;">
        <button id="opTabTransfer" class="op-tab-btn">Перевод</button>
        <button id="opTabPay" class="op-tab-btn">Оплата по QR</button>
      </div>
      <div id="operationsContent" style="margin-top:40px;width:100%;"></div>
    </div>
  `);
  openModal("operationsModal");

  const opTabTransfer = document.getElementById("opTabTransfer");
  const opTabPay = document.getElementById("opTabPay");
  const operationsContent = document.getElementById("operationsContent");

  showTransferTab();

  opTabTransfer.onclick = () => showTransferTab();
  opTabPay.onclick = () => showPayTab();

  function showTransferTab() {
    operationsContent.innerHTML = `
      <label>Кому (ID):</label>
      <input type="text" id="toUserIdInput" placeholder="ID получателя" style="width:100%;margin-bottom:10px;"/>
      <label>Сумма (₲):</label>
      <input type="number" id="transferAmountInput" step="0.00001" placeholder="Введите сумму" style="width:100%;margin-bottom:10px;"/>
      <button id="sendTransferBtn">Отправить</button>
    `;
    document.getElementById("sendTransferBtn").onclick = async () => {
      if (!currentUserId) return;
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
          document.getElementById("operationsModal")?.remove();
          fetchUserData();
        } else {
          alert(`❌ Ошибка перевода: ${data.error}`);
        }
      } catch (err) {
        console.error("Ошибка при переводе:", err);
      }
    };
  }

  function showPayTab() {
    // Центрируем блок камеры по середине модального окна
    operationsContent.innerHTML = `
      <div style="height:70vh; margin:auto; flex-direction:column; align-items:center; justify-content:center;">
        <video id="opPayVideo" muted playsinline style="width:100%; max-width:600px; border:none;"></video>  
      </div>
    `;
    const videoEl = document.getElementById("opPayVideo");
    startUniversalQRScanner(videoEl, (rawValue) => {
      document.getElementById("operationsModal")?.remove();
      const parsed = parseMerchantQRData(rawValue);
      if (!parsed.merchantId) {
        alert("❌ Не удалось извлечь merchantId");
        return;
      }
      confirmPayModal(parsed);
    });
  }

  function confirmPayModal({ merchantId, amount, purpose }) {
    createModal("confirmMerchantPayModal", `
      <h3>Оплата по QR коду 💳</h3>
      <p>Мерчант: ${merchantId}</p>
      <p>Сумма: ${amount} ₲</p>
      <p>Назначение: ${purpose}</p>
      <button id="confirmPayBtn">Оплатить</button>
    `);
    openModal("confirmMerchantPayModal");

    document.getElementById("confirmPayBtn").onclick = async () => {
      if (!currentUserId) return;
      try {
        const resp = await fetch(`${API_URL}/payMerchantOneTime`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: currentUserId, merchantId, amount, purpose })
        });
        const data = await resp.json();
        if (data.success) {
          // Убираем упоминание суммы и добавляем зелёный смайлик успеха
          alert("✅ Оплата прошла успешно!");
          document.getElementById("confirmMerchantPayModal")?.remove();
          fetchUserData();
        } else {
          alert(`❌ Ошибка оплаты: ${data.error}`);
        }
      } catch (err) {
        console.error("Ошибка payMerchantOneTime:", err);
      }
    };
  }
}

/* ================================
   6) UNIVERSAL QR SCAN
================================ */
function startUniversalQRScanner(videoEl, onSuccess) {
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
      videoEl.srcObject = stream;
      videoEl.play();

      if ('BarcodeDetector' in window) {
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
            console.error('BarcodeDetector detect:', err);
            requestAnimationFrame(scanFrame);
          }
        };
        requestAnimationFrame(scanFrame);
      } else {
        console.log('BarcodeDetector не поддерживается, fallback jsQR.');
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

/**
 * Парсим QR (merchantId, amount, purpose)
 */
function parseMerchantQRData(rawValue) {
  const merchantIdMatch = rawValue.match(/merchantId=([^&]+)/);
  const amountMatch = rawValue.match(/amount=([\d\.]+)/);
  const purposeMatch = rawValue.match(/purpose=([^&]+)/);

  const merchantId = merchantIdMatch ? merchantIdMatch[1] : "";
  const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;
  const purpose = purposeMatch ? decodeURIComponent(purposeMatch[1]) : "";
  return { merchantId, amount, purpose };
}

/* ================================
   7) МОДАЛКИ, УТИЛИТЫ
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
    "operationsModal","historyModal","exchangeModal",
    "merchantTransferModal","createOneTimeQRModal",
    "confirmMerchantPayModal"
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
   8) ОБНОВЛЕНИЕ UI (SWITCH user/merchant)
================================ */
function updateUI() {
  if (currentUserId) {
    showMainUI();
    updateTopBar();
  } else if (currentMerchantId) {
    openMerchantUI();
  } else {
    openAuthModal();
  }
}

/* ================================
   9) ЗАПУСК ПРИ ЗАГРУЗКЕ
================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (pendingMinedCoins > 0) {
    flushMinedCoins();
  }
  const savedMerchantId = localStorage.getItem("merchantId");
  if (savedMerchantId) {
    currentMerchantId = savedMerchantId;
    openMerchantUI();
    return;
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

// Если есть кнопка «Майнить», вешаем обработчик
document.getElementById("mineBtn")?.addEventListener("click", mineCoins);

/* ================================
   10) МАЙНИНГ, FETCH USER, ИСТОРИЯ, ОБМЕН
================================ */
// Майнинг
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

function formatBalance(num) {
  return parseFloat(num).toFixed(5);
}

/**
 * Загружаем инфу /user?userId=...
 */
async function fetchUserData() {
  if (isMining || !currentUserId) return;
  try {
    const resp = await fetch(`${API_URL}/user?userId=${currentUserId}`);
    if (!resp.ok) throw new Error(`Сервер ответил статус ${resp.status}`);
    const data = await resp.json();
    if (data.success && data.user) {
      if (data.user.blocked === 1) {
        alert("❌ Ваш аккаунт заблокирован");
        logout();
        return;
      }
      localBalance = parseFloat(data.user.balance || 0);
      updateBalanceUI();
      updateExchangeModalInfo(data.user);
      updateTopBar();
    }
  } catch (err) {
    console.error("Ошибка fetchUserData:", err);
  }
}

/**
 * История (транзакции + merchantPayments)
 */
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
    const data = await resp.json();
    if (resp.ok && data.success && data.transactions) {
      displayTransactionHistory(data.transactions);
    } else {
      console.error("Ошибка получения истории:", data.error);
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

  // Группируем записи по датам
  const groups = {};
  transactions.forEach(tx => {
    const d = new Date(tx.created_at);
    const label = getDateLabel(d);
    if (!groups[label]) groups[label] = [];
    groups[label].push(tx);
  });

  // Сортируем даты (от более новой к более старой)
  const sortedDates = Object.keys(groups).sort((a, b) => {
    const dateA = new Date(groups[a][0].created_at);
    const dateB = new Date(groups[b][0].created_at);
    return dateB - dateA;
  });

  // Рендерим каждую группу (день)
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

      const timeStr = new Date(tx.created_at).toLocaleTimeString("ru-RU");
      let opHTML = "";

      // Логика определения, исходящая ли операция или входящая для текущего пользователя
      if (tx.type === "merchant_payment") {
        // Оплата мерчанту (или запись с merchant_payments)
        opHTML = `
          <div>Оплата по QR коду 💳</div>
          <div>Мерчант: ${tx.merchant_id || (tx.to_user_id && tx.to_user_id.replace('MERCHANT:', '')) || '???'}</div>
          <div>Сумма: ₲ ${formatBalance(tx.amount)}</div>
          <div>Время операции: ${timeStr}</div>
        `;
      } else if (tx.from_user_id === currentUserId) {
        // Для ТЕКУЩЕГО пользователя это исходящая операция
        opHTML = `
          <div>Исходящая операция ⤴</div>
          <div>Кому: ${tx.to_user_id}</div>
          <div>Сумма: ₲ ${formatBalance(tx.amount)}</div>
          <div>Время операции: ${timeStr}</div>
        `;
      } else if (tx.to_user_id === currentUserId) {
        // Для ТЕКУЩЕГО пользователя это входящая операция
        opHTML = `
          <div>Входящая операция ⤵</div>
          <div>От кого: ${tx.from_user_id}</div>
          <div>Сумма: ₲ ${formatBalance(tx.amount)}</div>
          <div>Время операции: ${timeStr}</div>
        `;
      } else {
        // На случай, если операции вообще не связаны с текущим пользователем (редко)
        opHTML = `
          <div>Операция</div>
          <div>Сумма: ₲ ${formatBalance(tx.amount || 0)}</div>
          <div>Время операции: ${timeStr}</div>
        `;
      }

      op.innerHTML = opHTML;
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
   11) ОБМЕН
================================ */
function openExchangeModal() {
  createModal("exchangeModal", `
    <h3>Обмен</h3>
    <div style="display:flex;flex-direction:column;align-items:center;margin-top: auto;
    margin-bottom: auto;">
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
  if (exchangeRateInfo) exchangeRateInfo.textContent = `Курс: 1 ₲ = ${rubMultiplier.toFixed(2)} ₽`;
  if (rubBalanceInfo) rubBalanceInfo.textContent = `Баланс: ${rubBalance} ₽`;
  if (halvingLevel) halvingLevel.textContent = `Уровень халвинга: ${halvingStep}`;
}

/* ================================
   12) INIT
================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (pendingMinedCoins > 0) {
    flushMinedCoins();
  }
  const savedMerchantId = localStorage.getItem("merchantId");
  if (savedMerchantId) {
    currentMerchantId = savedMerchantId;
    openMerchantUI();
    return;
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

// Если есть #mineBtn, привязываем
document.getElementById("mineBtn")?.addEventListener("click", mineCoins);

/* ===================================
   ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
==================================== */
const API_URL = "https://mkntw-github-io.onrender.com"; // Ваш backend-сервер

let currentUserId = localStorage.getItem("userId") || null;
let currentMerchantId = localStorage.getItem("merchantId") || null;

let pendingMinedCoins = parseFloat(localStorage.getItem("pendingMinedCoins")) || 0;
let localBalance = 0;       // баланс пользователя
let merchantBalance = 0;    // баланс мерчанта

let isMining = false;
let mineTimer = null;
let updateInterval = null;
let currentHalvingStep = 0; // для halvingInfo
let lastDirection = null;  // хранит направление последней операции (например, 'rub_to_coin' или 'coin_to_rub')
let cycleCount = 0;        // счетчик для синусоидальной динамики
let exchangeChartInstance = null;

/* ===================================
   УТИЛИТЫ ФОРМАТИРОВАНИЯ
==================================== */
function formatBalance(num) {
  return parseFloat(num).toFixed(5);
}

/* ===================================
   Функция для вычисления синусоидального модификатора
==================================== */

function getSinusoidalRateModifier() {
  const frequency = 0.1;  // период колебаний
  const amplitude = 0.02; // максимальное отклонение
  cycleCount++;
  return amplitude * Math.sin(cycleCount * frequency);
}

/* ===================================
   МОДАЛКИ: СОЗДАНИЕ, ОТКРЫТИЕ, ЗАКРЫТИЕ
==================================== */
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

  // Для указанных модалок разрешаем закрытие по клику на оверлей
  const closeOnOverlay = [
    "operationsModal", "historyModal", "exchangeModal",
    "merchantTransferModal", "createOneTimeQRModal",
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

function closeAllModals() {
  document.querySelectorAll(".modal").forEach(m => m.classList.add("hidden"));
}

/* ===================================
   АВТОРИЗАЦИЯ: ВХОД, РЕГИСТРАЦИЯ, ВЫХОД, МОДАЛКА
==================================== */
async function login() {
  const loginVal = document.getElementById("loginInput")?.value;
  const passVal = document.getElementById("passwordInput")?.value;
  if (!loginVal || !passVal) {
    alert("❌ Введите логин и пароль");
    return;
  }

  try {
    // Попытка входа как пользователь
    const userResp = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: loginVal, password: passVal })
    });
    const userData = await userResp.json();
    if (userResp.ok && userData.success) {
      currentUserId = userData.userId;
      localStorage.setItem("userId", currentUserId);
      localStorage.removeItem("merchantId");
      currentMerchantId = null;
      document.getElementById("authModal")?.remove();
      createUI();
      updateUI();
      fetchUserData(); // Обновляем данные пользователя
      return;
    } else {
      // Если не удалось, пробуем мерчанта
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
        return;
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
        alert(`❌ Ошибка регистрации: ${data.error}`);
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
  clearInterval(updateInterval); // Останавливаем автоматическое обновление при выходе
  openAuthModal();
  updateUI(); // Обновляем UI после выхода
}

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
            <h4>Вход</h4>
            <input type="text" id="loginInput" placeholder="Логин">
            <input type="password" id="passwordInput" placeholder="Пароль">
            <button id="loginSubmitBtn">Войти</button>
          </div>
          <div id="registerSection" style="display:none;">
            <h4>Регистрация</h4>
            <input type="text" id="regLogin" placeholder="Логин">
            <input type="password" id="regPassword" placeholder="Пароль">
            <button id="registerSubmitBtn">Зарегистрироваться</button>
          </div>
        </div>
        <button id="toggleAuthBtn">Войти/Зарегистрироваться</button>
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

/* ===================================
   UI ПОЛЬЗОВАТЕЛЯ
==================================== */
function createUI() {
  showMainUI();
  fetchUserData(); // Вызываем сразу для первоначального отображения данных
  updateInterval = setInterval(fetchUserData, 2000); // Автоматическое обновление каждые 2 секунды
}

function showMainUI() {
  // Верхняя панель
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
  
  // Нижняя панель
  if (!document.getElementById("bottomBar")) {
    const bottomBar = document.createElement("div");
    bottomBar.id = "bottomBar";
    bottomBar.innerHTML = `
      <button id="operationsBtn">Операции</button>
      <button id="historyBtn">История</button>
      <button id="exchangeBtn">Обменять</button>
    `;
    document.body.appendChild(bottomBar);
    document.getElementById("operationsBtn").addEventListener("click", openOperationsModal);
    document.getElementById("historyBtn").addEventListener("click", openHistoryModal);
    document.getElementById("exchangeBtn").addEventListener("click", openExchangeModal);
  }
  document.getElementById("bottomBar").classList.remove("hidden");
  document.getElementById("balanceDisplay")?.classList.remove("hidden");
  document.getElementById("mineContainer")?.classList.remove("hidden");
  updateInterval = setInterval(fetchUserData, 2000);
}

function updateTopBar() {
  const userIdDisplay = document.getElementById("userIdDisplay");
  if (userIdDisplay) {
    userIdDisplay.textContent = currentUserId ? `ID: ${currentUserId}` : "Не авторизован";
  }
}


function hideMainUI() {
  document.getElementById("topBar")?.classList.add("hidden");
  document.getElementById("bottomBar")?.classList.add("hidden");
  document.getElementById("balanceDisplay")?.classList.add("hidden");
  document.getElementById("mineContainer")?.classList.add("hidden");
  clearInterval(updateInterval);
}

/* ===================================
   UI МЕРЧАНТА
==================================== */
// Интерфейс мерчанта
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
    <div class="merchant-buttons" style="display: flex; gap: 10px; margin-top: 20px;">
      <button id="merchantCreateQRBtn" class="btn btn-primary">Создать QR</button>
      <button id="merchantTransferBtn" class="btn btn-primary">Перевести</button>
      <button id="merchantLogoutBtn" class="btn btn-primary">Выйти</button>
    </div>
    <div id="merchantQRContainer" style="margin-top: 40px;"></div>
  `;
  document.body.appendChild(merchDiv);

  document.getElementById("merchantCreateQRBtn").addEventListener("click", openOneTimeQRModal);
  document.getElementById("merchantTransferBtn").addEventListener("click", openMerchantTransferModal);
  document.getElementById("merchantLogoutBtn").addEventListener("click", logout);

  fetchMerchantData();
}

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

/* === Модальное окно "Создать запрос на оплату" === */
function openOneTimeQRModal() {
  createModal("createOneTimeQRModal", `
    <div class="modal-overlay" 
         onclick="if(event.target === this) closeModal('createOneTimeQRModal');" 
         style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
      <div class="modal-content" style="width: 85vw; max-width: 500px; padding: 20px; text-align: center;">
        <h3>Создать запрос на оплату</h3>
        <label for="qrAmountInput">Сумма (₲):</label>
        <input type="number" id="qrAmountInput" step="0.00001" placeholder="Введите сумму" 
               style="width: 100%; max-width: 200px; margin: 5px 0;" oninput="calcRubEquivalent()">
        <p id="qrRubEquivalent"></p>
        <label for="qrPurposeInput">Назначение:</label>
        <input type="text" id="qrPurposeInput" placeholder="Например, заказ #123" 
               style="width: 100%; max-width: 200px; margin: 5px 0;">
        <button id="createQRBtn" class="btn btn-primary" style="margin-top: 15px;">Создать</button>
      </div>
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
    // Закрываем окно запроса на оплату и открываем окно с QR-кодом
    closeModal("createOneTimeQRModal");
    createMerchantQR(amountVal, purposeVal);
  };
}

function calcRubEquivalent() {
  const coinVal = parseFloat(document.getElementById("qrAmountInput")?.value) || 0;
  const rubMultiplier = 1 + currentHalvingStep * 0.02;
  const rubVal = coinVal * rubMultiplier;
  document.getElementById("qrRubEquivalent").textContent = `≈ ${rubVal.toFixed(2)} RUB`;
}

/* === Модальное окно с QR-кодом и мониторинг оплаты === */
function createMerchantQR(amount, purpose) {
  const qrData = `guga://merchantId=${currentMerchantId}&amount=${amount}&purpose=${encodeURIComponent(purpose)}`;
  
  createModal("merchantQRModal", `
    <div class="modal-overlay" 
         onclick="if(event.target === this) closeModal('merchantQRModal');" 
         style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
      <div class="modal-content" style="width: 85vw; max-width: 500px; padding: 20px; text-align: center;">
        <div id="merchantQRModalContainer"></div>
        <p style="margin-top: 15px; font-weight: bold;">Запрашиваемая сумма: ${amount} ₲</p>
      </div>
    </div>
  `);
  openModal("merchantQRModal");

  if (typeof QRCode === "function") {
    const qrElem = document.createElement("div");
    document.getElementById("merchantQRModalContainer").appendChild(qrElem);
    new QRCode(qrElem, {
      text: qrData,
      width: 280,
      height: 250,
      correctLevel: QRCode.CorrectLevel.L
    });
  } else {
    document.getElementById("merchantQRModalContainer").innerHTML = `QR Data: ${qrData}`;
  }

  // Начинаем мониторинг статуса оплаты (проверка каждые 3 секунды)
  monitorPayment(qrData, amount);
}

function monitorPayment(qrData, amount) {
  const checkInterval = setInterval(async () => {
    try {
      // Пример запроса для проверки оплаты (адаптируйте под своё API)
      const response = await fetch(`${API_URL}/checkPaymentStatus?merchantId=${currentMerchantId}&qrData=${encodeURIComponent(qrData)}`);
      const data = await response.json();
      if (data.success && data.paid) {
        clearInterval(checkInterval);
        closeModal("merchantQRModal");
        alert("✅ Оплата успешно прошла и поступила на ваш баланс!");
        fetchMerchantBalance();
      }
    } catch (error) {
      console.error("Ошибка проверки статуса оплаты:", error);
    }
  }, 3000);
}

/* === Модальное окно перевода на пользователя === */
function openMerchantTransferModal() {
  createModal("merchantTransferModal", `
    <div class="modal-overlay" 
         onclick="if(event.target === this) closeModal('merchantTransferModal');" 
         style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
      <div class="modal-content" style="width: 85vw; max-width: 500px; padding: 20px; text-align: center;">
        <h3>Перевести на пользователя</h3>
        <label for="merchantToUserIdInput">Кому (ID):</label>
        <input type="text" id="merchantToUserIdInput" placeholder="Введите ID" 
               style="width: 100%; max-width: 200px; margin: 5px 0;">
        <label for="merchantTransferAmountInput">Сумма (₲):</label>
        <input type="number" id="merchantTransferAmountInput" step="0.00001" placeholder="Сумма" 
               style="width: 100%; max-width: 200px; margin: 5px 0;">
        <button id="merchantTransferSendBtn" class="btn btn-primary" style="margin-top: 15px;">Отправить</button>
      </div>
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
      closeModal("merchantTransferModal");
      fetchMerchantBalance();
    } else {
      alert("❌ Ошибка перевода: " + (data.error || "Неизвестная ошибка"));
    }
  } catch (err) {
    console.error("Сбой merchantTransfer:", err);
  }
}

/* ===================================
   ОПЕРАЦИИ ПОЛЬЗОВАТЕЛЯ (ПЕРЕВОД / ОПЛАТА)
==================================== */
function openOperationsModal() {
  createModal("operationsModal", `
    <div style="width:90%;max-width:400px;display:flex;flex-direction:column;align-items:center;">
      <h3>Операции</h3>
      <div id="operationsTabs" style="display:flex;gap:10px;">
        <button id="opTabTransfer" class="op-tab-btn">Перевод</button>
        <button id="opTabPay" class="op-tab-btn">Оплата по QR</button>
      </div>
      <div id="operationsContent" style="margin-top:80px;"></div>
    </div>
  `);
  openModal("operationsModal");
  const opTabTransfer = document.getElementById("opTabTransfer");
  const opTabPay = document.getElementById("opTabPay");
  const operationsContent = document.getElementById("operationsContent");

  showTransferTab();

  opTabTransfer.onclick = showTransferTab;
  opTabPay.onclick = showPayTab;

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
          closeModal("operationsModal");
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
    operationsContent.innerHTML = `
      <div style="height:40vh; margin-top:-35px; display:flex; flex-direction:column; align-items:center; justify-content:center; width: 100%;
    margin: auto;">
        <video id="opPayVideo" muted playsinline style="width:100%; max-width:600px; border:2px solid black;"></video>
      </div>
    `;
    const videoEl = document.getElementById("opPayVideo");
    startUniversalQRScanner(videoEl, (rawValue) => {
      closeModal("operationsModal");
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
      <div style="display: flex; flex-direction: column; height: 100%;">
        <h3>Оплата по QR коду 💳</h3>
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items:center;">
          <p>Мерчант: ${merchantId}</p>
          <p>Сумма: ${amount} ₲</p>
          <p>Назначение: ${purpose}</p>
          <button id="confirmPayBtn">Оплатить</button>
        </div>
      </div>
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
          alert("✅ Оплата прошла успешно!");
          closeModal("confirmMerchantPayModal");
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

/* ===================================
   UNIVERSAL QR SCAN
==================================== */
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

function parseMerchantQRData(rawValue) {
  const merchantIdMatch = rawValue.match(/merchantId=([^&]+)/);
  const amountMatch = rawValue.match(/amount=([\d\.]+)/);
  const purposeMatch = rawValue.match(/purpose=([^&]+)/);
  const merchantId = merchantIdMatch ? merchantIdMatch[1] : "";
  const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;
  const purpose = purposeMatch ? decodeURIComponent(purposeMatch[1]) : "";
  return { merchantId, amount, purpose };
}

/* ===================================
   ОБМЕН ВАЛЮТЫ (ГРАФИК И КУРС)
==================================== */
// Глобальные переменные для состояния обмена
let currentExchangeDirection = "coin_to_rub"; // "coin_to_rub" – обмен монет на рубли; "rub_to_coin" – обмен рублей на монеты
let currentExchangeRate = 0; // Актуальный курс, получаемый с сервера

// Функция открытия модального окна обмена с новым статичным интерфейсом
async function openExchangeModal() {
  createModal("exchangeModal", `
    <style>
      .exchange-container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        background-color: transparent; /* прозрачный фон */
        max-height: 80vh;
        overflow-y: auto;
      }
      .main-header {
        text-align: center;
        font-size: 24px;
        font-weight: bold;
        margin-bottom: 20px;
      }
      .exchange-header h3 {
        text-align: center;
        margin-bottom: 50px;
        font-size: 16px;  /* уменьшенный шрифт */
        font-weight: normal;  /* менее жирный */
      }
      .exchange-body {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      /* Контейнер для трёх блоков: отправляемая валюта, кнопка смены, получаемая валюта */
      .exchange-row {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        margin-bottom: 20px;
      }
      .fromSection, .toSection {
        flex: 1;
        max-width: 45%;
        text-align: center;
      }
      /* Фиксированный центральный блок для кнопки смены направлений */
      .swap-container {
        width: 60px;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .currency-box {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 10px;
      }
      .currency-icon {
        width: 40px;
        height: 40px;
        margin-right: 10px;
        border: none; /* без границ */
      }
      .currency-name {
        font-weight: bold;
        font-size: 18px;
      }
      .currency-description {
        font-size: 14px;
        color: gray;
      }
      .amount-box {
        text-align: center;
      }
      .currency-input {
        width: 100%;
        padding: 10px;
        margin-bottom: 10px;
        font-size: 16px;
        border: none; /* без границ */
        border-radius: 5px;
        background: transparent;
      }
      .swap-btn {
        background-color: transparent;
        border: none;
        cursor: pointer;
      }
      .swap-btn img {
        border: none; /* без границ */
      }
      .exchange-btn {
        background-color: transparent;
        color: #28a745;
        padding: 15px 30px;
        border: 2px solid #000;
        cursor: pointer;
        font-size: 16px;
      }
      /* Стили для графика */
      #exchangeChart {
        width: 100%;
        height: 300px;
      }
      .btn-container {
        width: 100%;
        text-align: center;
        margin-top: 0px; /* кнопка выше */
      }
    </style>
    <div class="exchange-container">
      <!-- Верхний заголовок -->
      <div class="main-header">Обменять</div>
      
      <!-- Блок графика обменных курсов -->
      <div id="exchangeChartContainer" style="width:100%; max-width:600px; margin: 0 auto;">
        <canvas id="exchangeChart"></canvas>
      </div>
      
      <!-- Статичный курс, полученный с сервера -->
      <div class="exchange-header">
        <h3 id="currentRateDisplay">Курс обмена: --</h3>
      </div>
      
      <!-- Форма обмена -->
      <div class="exchange-body">
        <div class="exchange-row">
          <!-- Секция отправляемой валюты (from) -->
          <div class="fromSection" id="fromSection">
            <div class="currency-box">
              <img id="fromIcon" src="15.png" alt="GUGA" class="currency-icon">
              <div>
                <p class="currency-name" id="fromCurrencyName">GUGA</p>
                <p class="currency-description" id="fromCurrencyDesc">GugaCoin</p>
              </div>
            </div>
            <div class="amount-box">
              <input type="number" id="amountInput" placeholder="Обменять" class="currency-input" oninput="updateExchange()">
              <p id="balanceInfo">0.00000 ₲</p>
            </div>
          </div>
          
          <!-- Кнопка смены направления (swap) -->
          <div class="swap-container">
            <button id="swapBtn" class="swap-btn" onclick="swapCurrencies()">
              <img src="20.png" alt="Swap" style="width:40px; height:40px;">
            </button>
          </div>
          
          <!-- Секция получаемой валюты (to) -->
          <div class="toSection" id="toSection">
            <div class="currency-box">
              <img id="toIcon" src="18.png" alt="RUB" class="currency-icon">
              <div>
                <p class="currency-name" id="toCurrencyName">RUB</p>
                <p class="currency-description" id="toCurrencyDesc">Рубль</p>
              </div>
            </div>
            <div class="amount-box">
              <input type="text" id="toAmount" placeholder="Сумма" class="currency-input" disabled>
              <p id="toBalanceInfo">0.00 ₽</p>
            </div>
          </div>
        </div>
        
        <!-- Кнопка для выполнения обмена, расположенная по центру внизу -->
        <div class="btn-container">
          <button id="btnPerformExchange" class="exchange-btn">Обменять</button>
        </div>
      </div>
    </div>
  `);
  
  openModal("exchangeModal");

  // Устанавливаем начальное направление обмена (по умолчанию: обмен монет на рубли)
  currentExchangeDirection = "coin_to_rub";
  updateCurrencyLabels();

  // Загружаем баланс, курс и данные для графика, обновляем статичный курс
  await loadBalanceAndExchangeRate();
  updateCurrentRateDisplay();
  drawExchangeChart();

  // Назначаем обработчик для кнопки выполнения обмена
  document.getElementById("btnPerformExchange").addEventListener("click", function() {
    handleExchange(currentExchangeDirection);
  });
}

// При вводе суммы рассчитываем результат обмена и выводим его в поле "toAmount"
function updateExchange() {
  const amountInput = document.getElementById("amountInput");
  const toAmount = document.getElementById("toAmount");
  const amount = parseFloat(amountInput.value);
  if (isNaN(amount)) {
    toAmount.value = "";
    return;
  }
  let result = 0;
  if (currentExchangeDirection === "coin_to_rub") {
    result = amount * currentExchangeRate;
    toAmount.value = result.toFixed(2);
  } else { // rub_to_coin
    result = amount / currentExchangeRate;
    toAmount.value = result.toFixed(5);
  }
}

// Функция смены направления обмена – объекты остаются на своих местах
function swapCurrencies() {
  currentExchangeDirection = currentExchangeDirection === "coin_to_rub" ? "rub_to_coin" : "coin_to_rub";
  updateCurrencyLabels();
  // Очищаем поля ввода
  document.getElementById("amountInput").value = "";
  document.getElementById("toAmount").value = "";
  // Перезагружаем балансы для статичного отображения
  loadBalanceAndExchangeRate();
}

// Обновление подписей и иконок в форме обмена (без смещения объектов)
function updateCurrencyLabels() {
  if (currentExchangeDirection === "coin_to_rub") {
    // Отправляемая валюта: монеты (GUGA), получаемая: рубли (RUB)
    document.getElementById("fromCurrencyName").textContent = "GUGA";
    document.getElementById("fromCurrencyDesc").textContent = "GugaCoin";
    document.getElementById("fromIcon").src = "15.png";
    document.getElementById("toCurrencyName").textContent = "RUB";
    document.getElementById("toCurrencyDesc").textContent = "Рубль";
    document.getElementById("toIcon").src = "18.png";
    document.getElementById("amountInput").placeholder = "Обменять";
  } else {
    // Отправляемая валюта: рубли (RUB), получаемая: монеты (GUGA)
    document.getElementById("fromCurrencyName").textContent = "RUB";
    document.getElementById("fromCurrencyDesc").textContent = "Рубль";
    document.getElementById("fromIcon").src = "18.png";
    document.getElementById("toCurrencyName").textContent = "GUGA";
    document.getElementById("toCurrencyDesc").textContent = "GugaCoin";
    document.getElementById("toIcon").src = "15.png";
    document.getElementById("amountInput").placeholder = "Обменять";
  }
}

// Функция обработки обмена. Курс отображается статично (берётся с сервера)
async function handleExchange(direction) {
  const userId = localStorage.getItem("userId");
  const amountInput = document.getElementById("amountInput");
  if (!amountInput) {
    alert("Поле ввода суммы не найдено");
    return;
  }
  const amount = parseFloat(amountInput.value);
  if (isNaN(amount) || amount <= 0) {
    alert("Введите корректную сумму для обмена");
    return;
  }
  
  // Защита от циклических операций
  if (lastDirection !== null && lastDirection === direction) {
    alert("Цикличные операции запрещены. Попробуйте выполнить обратную операцию или подождите.");
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, direction, amount })
    });
    
    const data = await response.json();
    if (data.success) {
      // Отображаем курс, полученный с сервера, без инверсии
      document.getElementById("currentRateDisplay").textContent =
          `Курс обмена: 1 ₲ = ${parseFloat(data.currentratedisplay).toFixed(2)} ₽`;
      
      // Обновляем баланс и данные графика
      await loadBalanceAndExchangeRate();
      
      let exchangeMessage = "";
      if (direction === "rub_to_coin") {
        exchangeMessage = `Обмен выполнен успешно! Вы обменяли ${amount} ₽ на ${parseFloat(data.exchanged_amount).toFixed(5)} ₲`;
      } else if (direction === "coin_to_rub") {
        exchangeMessage = `Обмен выполнен успешно! Вы обменяли ${amount} ₲ на ${parseFloat(data.exchanged_amount).toFixed(2)} ₽`;
      }
      alert(exchangeMessage);
      
      lastDirection = direction;
      setTimeout(() => { lastDirection = null; }, 5000);
    } else {
      alert('Ошибка обмена: ' + data.error);
    }
  } catch (error) {
    console.error('Ошибка при обмене:', error);
    alert('Произошла ошибка при обмене');
  }
}

// Функция записи транзакции на сервер с добавлением клиентского времени
async function recordTransaction(transaction) {
  try {
    const clientTime = new Date().toISOString();
    const response = await fetch(`${API_URL}/exchange_transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        ...transaction, 
        created_at: clientTime 
      })
    });
    const data = await response.json();
    if (data.success) {
      console.log('Транзакция сохранена успешно');
    } else {
      console.error('Ошибка записи транзакции:', data.error);
    }
  } catch (error) {
    console.error('Ошибка записи транзакции:', error);
  }
}

// Функция загрузки баланса пользователя и истории обменных курсов.
// Баланс под каждой валютой отображается статично, а курс берётся с сервера.
async function loadBalanceAndExchangeRate() {
  const userId = localStorage.getItem("userId");
  try {
    const response = await fetch(`${API_URL}/user?userId=${userId}`);
    const data = await response.json();
    if (data.success && data.user) {
      if (currentExchangeDirection === "coin_to_rub") {
        const coinBalance = data.user.balance || 0;
        document.getElementById("balanceInfo").textContent = `${coinBalance.toFixed(5)} ₲`;
        document.getElementById("toBalanceInfo").textContent = `${(data.user.rub_balance || 0).toFixed(2)} ₽`;
      } else {
        const rubBalance = data.user.rub_balance || 0;
        document.getElementById("balanceInfo").textContent = `${rubBalance.toFixed(2)} ₽`;
        document.getElementById("toBalanceInfo").textContent = `${(data.user.balance || 0).toFixed(5)} ₲`;
      }
    }
    
    const rateResponse = await fetch(`${API_URL}/exchangeRates?limit=200`);
    const rateData = await rateResponse.json();
    if (rateData.success && rateData.rates && rateData.rates.length > 0) {
      drawExchangeChart(rateData.rates);
      const latestRate = parseFloat(rateData.rates[0].exchange_rate);
      currentExchangeRate = latestRate;
      document.getElementById("currentRateDisplay").textContent = `Курс обмена: 1 ₲ = ${latestRate.toFixed(2)} ₽`;
    } else {
      document.getElementById("currentRateDisplay").textContent = "Курс обмена: Данные отсутствуют";
      console.error('Ошибка: нет данных для графика обменных курсов');
    }
  } catch (error) {
    console.error('Ошибка при загрузке данных:', error);
  }
}

// Функция обновления отображения курса (статично)
function updateCurrentRateDisplay() {
  const displayEl = document.getElementById("currentRateDisplay");
  if (displayEl) {
    displayEl.textContent = currentExchangeRate
      ? `Курс обмена: 1 ₲ = ${currentExchangeRate.toFixed(2)} ₽`
      : "Курс обмена: --";
  }
}

// Функция построения графика обменных курсов с использованием Chart.js
function drawExchangeChart(rates) {
  if (!rates || !Array.isArray(rates) || rates.length === 0) {
    console.error('Ошибка: отсутствуют данные для отображения графика');
    return;
  }
  
  const sortedRates = rates.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  if (exchangeChartInstance) {
    exchangeChartInstance.destroy();
  }
  
  const labels = sortedRates.map(rate => {
    const date = new Date(rate.created_at);
    return date.getHours().toString().padStart(2, '0') + ":" +
           date.getMinutes().toString().padStart(2, '0');
  });
  const dataPoints = sortedRates.map(rate => parseFloat(rate.exchange_rate));
  
  const ctx = document.getElementById("exchangeChart").getContext("2d");
  exchangeChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Курс обмена',
        data: dataPoints,
        fill: false,
        borderColor: 'green',
        tension: 0.5,
        pointRadius: 0,
        borderCapStyle: 'round'
      }]
    },
    options: {
      layout: { padding: 0 },
      scales: {
        x: {
          grid: {
            display: false,
            drawBorder: false,
            drawTicks: false,
            borderColor: 'transparent',
            borderWidth: 0
          },
          ticks: { display: false }
        },
        y: {
          position: 'right',
          grid: {
            display: true,
            drawBorder: false,
            drawTicks: false,
            borderColor: 'transparent',
            borderWidth: 0,
            color: 'rgba(0,0,0,0.1)'
          },
          ticks: { beginAtZero: false }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

/* ===================================
   МАЙНИНГ
==================================== */

// Функция майнинга
function mineCoins() {
  // Загружаем текущий баланс из localStorage, если он есть, или начинаем с 0
  let localBalance = parseFloat(localStorage.getItem("localBalance")) || 0;

  // Увеличиваем баланс на 0.00001
  localBalance += 0.00001;

  // Обновляем отображение баланса на экране
  updateBalanceDisplay(localBalance);

  // Сохраняем обновленный баланс в localStorage
  localStorage.setItem("localBalance", localBalance.toFixed(5));

  // Добавляем к ожидающим монетам для отправки на сервер
  let pendingMinedCoins = parseFloat(localStorage.getItem("pendingMinedCoins")) || 0;
  pendingMinedCoins += 0.00001;
  localStorage.setItem("pendingMinedCoins", pendingMinedCoins.toFixed(5));

  // Таймер для отправки данных на сервер через 1500 мс после последнего клика
  if (mineTimer) clearTimeout(mineTimer);

  mineTimer = setTimeout(() => {
    isMining = false;
    flushMinedCoins();  // Отправляем данные на сервер
  }, 1500);
}

// Привязываем обработчик события к кнопке
document.getElementById("mineBtn").addEventListener("click", mineCoins);


// Отправка данных на сервер
async function flushMinedCoins() {
  let pendingMinedCoins = parseFloat(localStorage.getItem("pendingMinedCoins")) || 0;

  if (!currentUserId || pendingMinedCoins <= 0) return;

  try {
    const resp = await fetch(`${API_URL}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUserId, amount: pendingMinedCoins })
    });

    if (!resp.ok) throw new Error(`Сервер ответил статусом ${resp.status}`);

    // После успешной отправки очищаем локальное хранилище
    pendingMinedCoins = 0;
    localStorage.setItem("pendingMinedCoins", pendingMinedCoins);

    // Обновляем данные пользователя
    fetchUserData();
  } catch (err) {
    console.error("Ошибка flushMinedCoins:", err);
  }
}

// Функция для обновления отображения баланса
function updateBalanceDisplay(localBalance) {
  const balanceValue = document.getElementById("balanceValue");
  if (balanceValue) {
    balanceValue.textContent = `${localBalance.toFixed(5)} ₲`;  // отображаем баланс с точностью до 5 знаков
  }
}

/* ===================================
   ЗАГРУЗКА ДАННЫХ ПОЛЬЗОВАТЕЛЯ
==================================== */
async function fetchUserData() {
  const userId = localStorage.getItem("userId");
  if (!userId) {
    console.error("Пользователь не авторизован");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/user?userId=${userId}`);
    const data = await response.json();
    
    if (data.success && data.user) {
      // Загружаем балансы и обновляем UI
      const userBalance = data.user.balance || 0;
      const rubBalance = data.user.rub_balance || 0;

      // Проверяем наличие элементов перед обновлением
      const balanceValue = document.getElementById("balanceValue");
      const rubBalanceInfo = document.getElementById("rubBalanceInfo");

      if (balanceValue) {
        balanceValue.textContent = `${userBalance.toFixed(5)} ₲`; // Обновляем баланс пользователя
      } else {
        console.warn('Элемент balanceValue не найден');
      }

      if (rubBalanceInfo) {
        rubBalanceInfo.textContent = `${rubBalance.toFixed(2)} ₽`; // Обновляем баланс в рублях
      }

      updateTopBar();
    } else {
      console.error('Ошибка в ответе от сервера', data);
    }
  } catch (error) {
    console.error("Ошибка загрузки данных пользователя:", error);
  }
}

/* ===================================
   ИСТОРИЯ ОПЕРАЦИЙ
==================================== */
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
  
  // Группировка транзакций по датам
  const groups = {};
  transactions.forEach(tx => {
    const d = new Date(tx.client_time || tx.created_at);
    const label = getDateLabel(d);
    if (!groups[label]) groups[label] = [];
    groups[label].push(tx);
  });
  const sortedDates = Object.keys(groups).sort((a, b) => {
    const dateA = new Date(groups[a][0].client_time || groups[a][0].created_at);
    const dateB = new Date(groups[b][0].client_time || groups[b][0].created_at);
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
      // Если присутствует client_time, используем его
      const timeStr = new Date(tx.client_time || tx.created_at).toLocaleTimeString("ru-RU");
      let opHTML = "";
      if (tx.type === "exchange") {
        const exchangeRate = tx.exchange_rate ? Number(tx.exchange_rate) : null;
        let creditedAmount = 'N/A';
        if (exchangeRate) {
          creditedAmount = tx.direction === 'rub_to_coin'
            ? (tx.amount / exchangeRate).toFixed(5) + ' ₲'
            : (tx.amount * exchangeRate).toFixed(2) + ' ₽';
        }
        opHTML = `
          <div>Обмен валюты 💱</div>
          <div>Направление: ${tx.direction === 'rub_to_coin' ? 'Рубли → Монеты' : 'Монеты → Рубли'}</div>
          <div>Сумма списания: ${tx.direction === 'rub_to_coin' ? tx.amount + ' ₽' : tx.amount + ' ₲'}</div>
          <div>Сумма зачисления: ${creditedAmount}</div>
          <div>Курс: 1 ₲ = ${exchangeRate ? exchangeRate.toFixed(2) : 'N/A'} ₽</div>
          <div>Время операции: ${timeStr}</div>
        `;
      } else if (tx.type === "merchant_payment") {
        opHTML = `
          <div>Оплата по QR 💳</div>
          <div>Мерчант: ${tx.merchant_id || (tx.to_user_id && tx.to_user_id.replace('MERCHANT:', '')) || '???'}</div>
          <div>Сумма: ₲ ${tx.amount}</div>
          <div>Время операции: ${timeStr}</div>
        `;
      } else if (tx.from_user_id === currentUserId) {
        opHTML = `
          <div>Исходящая операция ⤴</div>
          <div>Кому: ${tx.to_user_id}</div>
          <div>Сумма: ₲ ${formatBalance(tx.amount)}</div>
          <div>Время операции: ${timeStr}</div>
        `;
      } else if (tx.to_user_id === currentUserId) {
        opHTML = `
          <div>Входящая операция ⤵</div>
          <div>От кого: ${tx.from_user_id}</div>
          <div>Сумма: ₲ ${formatBalance(tx.amount)}</div>
          <div>Время операции: ${timeStr}</div>
        `;
      } else {
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

/* ===================================
   ОБНОВЛЕНИЕ UI
==================================== */
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

/* ===================================
   ИНИЦИАЛИЗАЦИЯ
==================================== */
document.addEventListener("DOMContentLoaded", () => {
  if (pendingMinedCoins > 0) {
    flushMinedCoins();
  }
  if (currentMerchantId) {
    openMerchantUI();
  } else if (currentUserId) {
    createUI(); // Создаем UI и сразу загружаем данные
    fetchUserData(); // После создания UI вызываем обновление данных
  } else {
    openAuthModal();
  }

  // Привязка кнопки майнинга (если существует)
  document.getElementById("mineBtn")?.addEventListener("click", mineCoins);
});


window.addEventListener("beforeunload", () => {
  if (pendingMinedCoins > 0) {
    flushMinedCoinsSync();
  }
});

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

/* ===================================
   УТИЛИТЫ ФОРМАТИРОВАНИЯ
==================================== */
function formatBalance(num) {
  return parseFloat(num).toFixed(5);
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
      closeModal("merchantTransferModal");
      fetchMerchantBalance();
    } else {
      alert("❌ Ошибка перевода мерчант->пользователь: " + (data.error || "Неизвестная ошибка"));
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
      <div style="height:40vh; margin-top:-50px; display:flex; flex-direction:column; align-items:center; justify-content:center;">
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
async function openExchangeModal() {
  // Создаём модальное окно для обмена с блоком графика
  createModal("exchangeModal", `
    <h3>Обмен</h3>
    <!-- Блок графика обмена -->
    <div id="exchangeChartContainer" style="width:90%;max-width:600px; margin-bottom:20px;">
      <h4 id="currentRateDisplay"></h4>
      <canvas id="exchangeChart"></canvas>
    </div>
    <div style="display: flex; flex-direction: column; align-items: center;">
      <p id="balanceInfo">0.00000 ₲</p>
      <p id="rubBalanceInfo">0.00 ₽</p>
      <p id="exchangeRateInfo">Курс: 1 ₲ = 0.00 ₽</p>
      <div>
        <label for="amountInput">Сумма:</label>
        <input type="number" id="amountInput" placeholder="Введите сумму" />
      </div>
      <div style="display: flex; gap: 35px; margin-top:10px;">
  <button id="rubToCoinBtn">₽ → ₲</button>
  <button id="coinToRubBtn">₲ → ₽</button>
</div>

      <p id="conversionResult"></p>
    </div>
  `);
  openModal("exchangeModal");

  // Ждём загрузку данных и обновляем курс
  await loadBalanceAndExchangeRate();
  updateCurrentRateDisplay();
  drawExchangeChart();

  // Используем setTimeout, чтобы убедиться, что элементы уже отрендерены
  setTimeout(() => {
    const rubBtn = document.getElementById("rubToCoinBtn");
    const coinBtn = document.getElementById("coinToRubBtn");
    if (rubBtn && coinBtn) {
      // Для отладки: выводим сообщение при клике
      rubBtn.addEventListener("click", () => {
        console.log("Нажата кнопка обмена: rub_to_coin");
        handleExchange("rub_to_coin");
      });
      coinBtn.addEventListener("click", () => {
        console.log("Нажата кнопка обмена: coin_to_rub");
        handleExchange("coin_to_rub");
      });
    } else {
      console.error("Кнопки обмена не найдены в DOM");
    }
  }, 100);
}

async function handleExchange(direction) {
  const userId = localStorage.getItem("userId");
  const amount = parseFloat(document.getElementById("amountInput").value);
  
  if (isNaN(amount) || amount <= 0) {
    alert("Введите корректную сумму для обмена");
    return;
  }

  const exchangeRateText = document.getElementById("exchangeRateInfo").textContent;
  const rateMatch = exchangeRateText.match(/=\s*([\d.]+)/);
  const exchangeRate = rateMatch ? parseFloat(rateMatch[1]) : null;
  
  if (!exchangeRate) {
    alert("Не удалось определить курс обмена");
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
      await loadBalanceAndExchangeRate();
      let exchangeMessage = '';
      let exchangedAmount = parseFloat(data.exchanged_amount);
      
      if (direction === 'rub_to_coin') {
        exchangeMessage = `Обмен выполнен успешно! Вы обменяли ${amount} ₽ на ${exchanged_amount.toFixed(5)} ₲`;
      } else if (direction === 'coin_to_rub') {
        exchangeMessage = `Обмен выполнен успешно! Вы обменяли ${amount} ₲ на ${exchanged_amount.toFixed(2)} ₽`;
      }
      alert(exchangeMessage);
    } else {
      alert('Ошибка выполнения обмена: ' + data.error);
    }
  } catch (error) {
    console.error('Ошибка при обмене:', error);
    alert('Произошла ошибка при обмене');
  }
}

async function recordTransaction(transaction) {
  try {
    // Время клиента в формате ISO
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


async function loadBalanceAndExchangeRate() {
  const userId = localStorage.getItem("userId");
  try {
    // Получаем данные пользователя (балансы)
    const response = await fetch(`${API_URL}/user?userId=${userId}`);
    const data = await response.json();
    if (data.success && data.user) {
      const rubBalance = data.user.rub_balance || 0;
      const coinBalance = data.user.balance || 0;
      document.getElementById("balanceInfo").textContent = `${coinBalance.toFixed(5)} ₲`;
      document.getElementById("rubBalanceInfo").textContent = `${rubBalance.toFixed(2)} ₽`;
    }
    
    // Получаем последний обменный курс из истории обменов
    const rateResponse = await fetch(`${API_URL}/exchangeRates`);
    const rateData = await rateResponse.json();
    if (rateData.success && rateData.rates && rateData.rates.length > 0) {
      // Предполагаем, что записи отсортированы по времени, и берем последнюю
      const latestRate = parseFloat(rateData.rates[rateData.rates.length - 1].exchange_rate);
      document.getElementById("exchangeRateInfo").textContent = `Курс: 1 ₲ = ${latestRate.toFixed(2)} ₽`;
    } else {
      // Если история пуста, можно оставить курс по умолчанию
      document.getElementById("exchangeRateInfo").textContent = `Курс обмена: 1 ₲ = 1.00 ₽`;
    }
  } catch (error) {
    console.error('Ошибка при загрузке данных:', error);
  }
}


function updateCurrentRateDisplay() {
  // Вычисляем текущий курс по формуле из halving
  const currentRate = 1 + currentHalvingStep * 0.02;
  const displayEl = document.getElementById("currentRateDisplay");
  if (displayEl) {
    displayEl.textContent = `Текущий курс: 1 ₲ = ${currentRate.toFixed(2)} ₽`;
  }
}

async function drawExchangeChart() {
  try {
    // Запрашиваем историю курсов с сервера
    const response = await fetch(`${API_URL}/exchangeRates`);
    const result = await response.json();
    if (!result.success || !result.rates) {
      console.error('Ошибка получения истории курсов');
      return;
    }
    
    // Формируем массивы меток (labels) и значений курса (dataPoints)
    const labels = result.rates.map(rateRecord => {
      const date = new Date(rateRecord.created_at);
      // Форматируем время как "HH:MM"
      return date.getHours().toString().padStart(2, '0') + ":" + date.getMinutes().toString().padStart(2, '0');
    });
    const dataPoints = result.rates.map(rateRecord => parseFloat(rateRecord.exchange_rate));
    
    // Если график уже существует, уничтожаем его
    if (window.exchangeChartInstance) {
      window.exchangeChartInstance.destroy();
    }
    
    const ctx = document.getElementById("exchangeChart").getContext("2d");
    window.exchangeChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '',             // подпись не нужна
          data: dataPoints,
          fill: false,
          borderColor: 'green',  // зеленая линия
          tension: 0.5,          // плавная кривая
          pointRadius: 0,        // точки не отображаются
          borderCapStyle: 'round'
        }]
      },
      options: {
        layout: {
          padding: 0           // убираем отступы
        },
        scales: {
          x: {
            grid: {
              display: false,        // отключаем вертикальные линии
              drawBorder: false,       // не рисуем границу
              drawTicks: false,
              borderColor: 'transparent', // прозрачная граница
              borderWidth: 0
            },
            ticks: {
              display: false         // отключаем подписи оси X
            }
          },
          y: {
            position: 'right',
            grid: {
              display: true,         // оставляем горизонтальные линии
              drawBorder: false,     // отключаем отрисовку боковой границы
              drawTicks: false,
              borderColor: 'transparent', // прозрачная граница
              borderWidth: 0,
              color: 'rgba(0,0,0,0.1)' // цвет горизонтальных линий
            },
            ticks: {
              beginAtZero: true
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  } catch (error) {
    console.error('Ошибка при построении графика обмена:', error);
  }
}


async function handleExchange(direction) {
  const userId = localStorage.getItem("userId");
  const amount = parseFloat(document.getElementById("amountInput").value);
  
  if (isNaN(amount) || amount <= 0) {
    alert("Введите корректную сумму для обмена");
    return;
  }

  // Извлекаем курс обмена из элемента с id="exchangeRateInfo"
  const exchangeRateText = document.getElementById("exchangeRateInfo").textContent;
  const rateMatch = exchangeRateText.match(/=\s*([\d.]+)/);
  const exchangeRate = rateMatch ? parseFloat(rateMatch[1]) : null;
  
  if (!exchangeRate) {
    alert("Не удалось определить курс обмена");
    return;
  }

  try {
    console.log("Отправка запроса обмена на сервер...");
    const response = await fetch(`${API_URL}/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, direction, amount })
    });
    
    const data = await response.json();
    
    if (data.success) {
      await loadBalanceAndExchangeRate();
      let exchangeMessage = '';
      let exchangedAmount = 0;

      // Определяем направление обмена и составляем сообщение
      if (direction === 'rub_to_coin') {
        // Получаем количество монет
        exchangedAmount = parseFloat(data.newCoinBalance); // Полученные монеты
        if (isNaN(exchangedAmount)) exchangedAmount = 0;
        exchangeMessage = `Обмен выполнен успешно! Вы обменяли ${amount} ₽ на ${exchangedAmount.toFixed(5)} ₲`;
      } else if (direction === 'coin_to_rub') {
        // Получаем количество рублей
        exchangedAmount = parseFloat(data.newRubBalance); // Полученные рубли
        if (isNaN(exchangedAmount)) exchangedAmount = 0;
        exchangeMessage = `Обмен выполнен успешно! Вы обменяли ${amount} ₲ на ${exchangedAmount.toFixed(2)} ₽`;
      }

      alert(exchangeMessage);  // Выводим результат обмена
    } else {
      alert('Ошибка выполнения обмена: ' + data.error);
    }
  } catch (error) {
    console.error('Ошибка при обмене:', error);
    alert('Произошла ошибка при обмене');
  }
}


async function recordTransaction(transaction) {
  try {
    // Получаем время клиента в ISO‑формате
    const clientTime = new Date().toISOString();
    const response = await fetch(`${API_URL}/exchange_transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Передаём клиентское время в отдельном поле
      body: JSON.stringify({ 
        ...transaction, 
        client_time: clientTime 
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

// Пример вызова обмена (POST /exchange)
function performExchange(userId, direction, amount) {
  fetch(`${API_URL}/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, direction, amount })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Обновляем балансы, если нужно:
        updateBalancesDisplay(data.newRubBalance, data.newCoinBalance);
        // Обновляем текущий курс обмена:
        updateCurrentRateDisplay(data.currentratedisply);
      } else {
        alert('Ошибка обмена: ' + data.error);
      }
    })
    .catch(err => console.error('Ошибка обмена:', err));
}

// Функция для обновления элемента с текущим курсом обмена
function updateCurrentRateDisplay(rate) {
  const rateDisplayEl = document.getElementById("currentratedisplay");
  if (rateDisplayEl) {
    rateDisplayEl.textContent = `Текущий курс: ${rate.toFixed(2)} ₽ за 1 монету`;
  }
}

// Пример вызова обмена:
function performExchange(userId, direction, amount) {
  fetch(`${API_URL}/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, direction, amount })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Обновление балансов и курса
        updateBalancesDisplay(data.newRubBalance, data.newCoinBalance);
        updateCurrentRateDisplay(data.currentratedisplay);
      } else {
        alert('Ошибка обмена: ' + data.error);
      }
    })
    .catch(err => console.error('Ошибка обмена:', err));
}

function updateExchangeRateInfo(rate) {
  const rateElement = document.getElementById("exchangeRateInfo");
  if (rateElement) {
    rateElement.textContent = `Курс обмена: 1 ₲ = ${rate.toFixed(2)} ₽`;
  }
}

// Пример вызова обмена:
function performExchange(userId, direction, amount) {
  fetch(`${API_URL}/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, direction, amount })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        updateBalancesDisplay(data.newRubBalance, data.newCoinBalance);
        // Обновляем элемент, отображающий курс обмена, с данными из последней операции
        updateExchangeRateInfo(data.currentratedisplay);
        // (Опционально) можно перерисовать график, если он тоже основан на истории обменов
        drawExchangeChart();
      } else {
        alert('Ошибка обмена: ' + data.error);
      }
    })
    .catch(err => console.error('Ошибка обмена:', err));
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
    console.log('Полученные данные пользователя:', data); // Логируем ответ сервера

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

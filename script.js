/* ===================================
   ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
==================================== */
const API_URL = "https://api.mkntw.ru"; // Ваш backend-сервер

// Не храним userId/merchantId в localStorage, опираемся на http-only cookie
let currentUserId = null;
let currentMerchantId = null;

let pendingMinedCoins = parseFloat(localStorage.getItem("pendingMinedCoins")) || 0;
let localBalance = 0;       // локальный баланс для визуального отклика
let merchantBalance = 0;    // баланс мерчанта

let isMining = false;
let mineTimer = null;
let updateInterval = null;

let currentHalvingStep = 0; // для halvingInfo
let lastDirection = null;   // хранит направление последней операции (например, 'rub_to_coin')
let cycleCount = 0;         // счётчик для синусоидальной динамики (если нужно)
let exchangeChartInstance = null;

// Для удобства (если потребуется):
const env = "development"; // или "production"

/* ===================================
   УТИЛИТЫ ФОРМАТИРОВАНИЯ
==================================== */
function formatBalance(num) {
  return parseFloat(num).toFixed(5);
}

/* ===================================
   Вспомогательная функция (пример, если нужна была синусоида)
==================================== */
function getSinusoidalRateModifier() {
  const frequency = 0.1;
  const amplitude = 0.02;
  cycleCount++;
  return amplitude * Math.sin(cycleCount * frequency);
}

/* ===================================
   МОДАЛЬНЫЕ ОКНА: СОЗДАНИЕ / ОТКРЫТИЕ / ЗАКРЫТИЕ
==================================== */
function createModal(id, htmlContent) {
  // Если уже есть элемент с таким id — удаляем, чтобы создать заново
  const existingModal = document.getElementById(id);
  if (existingModal) existingModal.remove();

  // Создаём обёртку-модал
  const modal = document.createElement("div");
  modal.id = id;
  modal.className = "modal hidden";
  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-content">
      <!-- Кнопка закрытия -->
      <button class="close-btn" onclick="closeModal('${id}')">×</button>
      ${htmlContent}
    </div>
  `;
  document.body.appendChild(modal);

  // Закрытие по клику на оверлей
  const overlay = modal.querySelector(".modal-overlay");
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeModal(id);
      }
    });
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
  document.querySelectorAll(".modal").forEach((m) => m.classList.add("hidden"));
}

/* ===================================
   АВТОРИЗАЦИЯ: ВХОД, РЕГИСТРАЦИЯ, ВЫХОД
==================================== */
async function login() {
  const loginVal = document.getElementById("loginInput")?.value;
  const passVal = document.getElementById("passwordInput")?.value;
  if (!loginVal || !passVal) {
    alert("❌ Введите логин и пароль");
    return;
  }
  const loader = document.getElementById("loadingIndicator");
  loader.classList.add("auth-loading");
  showGlobalLoading();

  try {
    // Пытаемся войти как обычный пользователь
    const userResp = await fetch(`${API_URL}/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: loginVal, password: passVal }),
    });
    const userData = await userResp.json();
    if (userResp.ok && userData.success) {
      // Успешная авторизация как пользователь
      await fetchUserData();
      document.getElementById("authModal")?.remove();
      createMainUI();
      updateUI();
      return;
    } else {
      // Если пользовательский вход не удался, пробуем мерчанта
      if (userData.error?.includes("блокирован")) {
        alert("❌ Ваш аккаунт заблокирован");
        return;
      }
      const merchResp = await fetch(`${API_URL}/merchantLogin`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginVal, password: passVal }),
      });
      const merchData = await merchResp.json();
      if (merchResp.ok && merchData.success) {
        // Успешная авторизация как мерчант
        await fetchMerchantData();
        document.getElementById("authModal")?.remove();
        openMerchantUI();
        return;
      } else {
        if (merchData.error?.includes("блокирован")) {
          alert("❌ Ваш мерчант-аккаунт заблокирован");
        } else {
          alert(`❌ Ошибка входа: ${merchData.error}`);
        }
      }
    }
  } catch (err) {
    console.error("Сбой при логине:", err);
  } finally {
    hideGlobalLoading();
    loader.classList.remove("auth-loading");
  }
}

async function register() {
  const loginVal = document.getElementById("regLogin")?.value;
  const passVal = document.getElementById("regPassword")?.value;
  if (!loginVal || !passVal) {
    alert("❌ Введите логин и пароль");
    return;
  }
  const loader = document.getElementById("loadingIndicator");
  loader.classList.add("auth-loading");
  showGlobalLoading();
  try {
    const resp = await fetch(`${API_URL}/register`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: loginVal, password: passVal }),
    });
    const data = await resp.json();
    if (resp.ok && data.success) {
      alert(`✅ Аккаунт создан! Ваш userId: ${data.userId}`);
      // После регистрации выполняем автоматический вход
      await login();
    } else {
      if (data.error?.includes("блокирован")) {
        alert("❌ Ваш аккаунт заблокирован");
      } else {
        alert(`❌ Ошибка регистрации: ${data.error}`);
      }
    }
  } catch (err) {
    console.error("Сбой при регистрации:", err);
  } finally {
    hideGlobalLoading();
    loader.classList.remove("auth-loading");
  }
}

async function logout() {
  try {
    await fetch(`${API_URL}/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch (err) {
    console.error("Ошибка при выходе:", err);
  }
  // Очищаем данные в памяти
  currentUserId = null;
  currentMerchantId = null;

  document.getElementById("balanceDisplay")?.classList.add("hidden");
  document.getElementById("mineContainer")?.classList.add("hidden");
  document.getElementById("merchantInterface")?.remove();
  document.getElementById("bottomBar")?.remove();

  closeAllModals();
  clearInterval(updateInterval);
  openAuthModal();
  updateUI();
}

/* Окно авторизации */
function openAuthModal() {
  hideMainUI();
  document.getElementById("merchantInterface")?.remove();

  let authModal = document.getElementById("authModal");
  if (authModal) authModal.remove();

  authModal = document.createElement("div");
  authModal.id = "authModal";
  authModal.className = "modal hidden";
  authModal.innerHTML = `
    <div class="modal-content" style="width:90%;max-width:400px;">
      <button class="close-btn" onclick="document.getElementById('authModal')?.classList.add('hidden')">×</button>
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

  // Открываем (убираем hidden)
  authModal.classList.remove("hidden");

  // Привязываем события
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
  // Начальное состояние
  document.getElementById("loginSection").style.display = "block";
  document.getElementById("registerSection").style.display = "none";
}

/* ===================================
   ГЛАВНЫЙ UI ДЛЯ ПОЛЬЗОВАТЕЛЯ
==================================== */
/* Убираем любой topBar (если был), вместо этого
   используем фиксированный блок #balanceDisplay и пр. */

function createMainUI() {
  // Блок bottomBar
  if (!document.getElementById("bottomBar")) {
    const bottomBar = document.createElement("div");
    bottomBar.id = "bottomBar";
    bottomBar.innerHTML = `
      <!-- Три кнопки внизу:
           1) "Главная" (может перезагружать/обновлять UI)
           2) "История"
           3) "Обменять"
      -->
      <button id="btnMain">Главная</button>
      <button id="historyBtn">История</button>
      <button id="exchangeBtn">Обменять</button>
    `;
    document.body.appendChild(bottomBar);

    // Привязываем события
    document.getElementById("btnMain").addEventListener("click", () => {
      // "Главная" — просто обновим UI
      updateUI();
    });
    document.getElementById("historyBtn").addEventListener("click", openHistoryModal);
    document.getElementById("exchangeBtn").addEventListener("click", openExchangeModal);
  }

  // Показываем блок с балансом, если скрыт
  document.getElementById("balanceDisplay")?.classList.remove("hidden");
  document.getElementById("mineContainer")?.classList.remove("hidden");

  // Добавим блок "Главная", если нужен (текстовый):
  if (!document.getElementById("mainTitle")) {
    const mainTitle = document.createElement("div");
    mainTitle.id = "mainTitle";
    mainTitle.textContent = "Главная";
    document.body.appendChild(mainTitle);
  }

  // Добавим контейнер с 2 кнопками: "Перевести" и "Оплата по QR"
  if (!document.getElementById("actionButtonsContainer")) {
    const container = document.createElement("div");
    container.id = "actionButtonsContainer";
    container.innerHTML = `
      <button id="transferBtn">Перевести</button>
      <button id="payQRBtn">Оплата по QR</button>
    `;
    document.body.appendChild(container);

    // Привязываем клик
    document.getElementById("transferBtn").addEventListener("click", openTransferModal);
    document.getElementById("payQRBtn").addEventListener("click", openPayQRModal);
  }

  // Запускаем циклическое обновление данных
  fetchUserData();
  clearInterval(updateInterval);
  updateInterval = setInterval(fetchUserData, 2000);
}

/* Скрыть главный UI */
function hideMainUI() {
  document.getElementById("balanceDisplay")?.classList.add("hidden");
  document.getElementById("mineContainer")?.classList.add("hidden");
  document.getElementById("mainTitle")?.remove();
  document.getElementById("actionButtonsContainer")?.remove();
  clearInterval(updateInterval);
}

/* ===================================
   ОТДЕЛЬНОЕ МОДАЛЬНОЕ ОКНО ДЛЯ "ПЕРЕВОД"
==================================== */
function openTransferModal() {
  createModal(
    "transferModal",
    `
      <h3>Перевод</h3>
      <div style="margin-top:20px; width:90%;max-width:400px;">
        <label>Кому (ID):</label>
        <input type="text" id="toUserIdInput" placeholder="ID получателя" style="width:100%; margin-bottom:10px;"/>
        <label>Сумма (₲):</label>
        <input type="number" id="transferAmountInput" step="0.00001" placeholder="Введите сумму" style="width:100%; margin-bottom:10px;"/>
        <button id="sendTransferBtn">Отправить</button>
      </div>
    `
  );
  openModal("transferModal");

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
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUserId: currentUserId, toUserId, amount }),
      });
      const data = await response.json();
      if (data.success) {
        alert("✅ Перевод выполнен успешно!");
        closeModal("transferModal");
        fetchUserData();
      } else {
        alert(`❌ Ошибка перевода: ${data.error}`);
      }
    } catch (err) {
      console.error("Ошибка при переводе:", err);
    }
  };
}

/* ===================================
   ОТДЕЛЬНОЕ МОДАЛЬНОЕ ОКНО "ОПЛАТА ПО QR"
==================================== */
function openPayQRModal() {
  createModal(
    "payQRModal",
    `
      <h3>Оплата по QR</h3>
      <div style="margin-top:20px; display:flex; flex-direction:column; align-items:center; width:90%;max-width:500px;">
        <video id="opPayVideo" muted playsinline style="width:100%; max-width:600px; border:2px solid black;"></video>
      </div>
    `
  );
  openModal("payQRModal");

  const videoEl = document.getElementById("opPayVideo");
  startUniversalQRScanner(videoEl, (rawValue) => {
    closeModal("payQRModal");
    const parsed = parseMerchantQRData(rawValue);
    if (!parsed.merchantId) {
      alert("❌ Не удалось извлечь merchantId из QR-кода");
      return;
    }
    confirmMerchantPayModal(parsed);
  });
}

/* Подтверждение оплаты мерчанту после сканирования QR */
function confirmMerchantPayModal({ merchantId, amount, purpose }) {
  createModal(
    "confirmMerchantPayModal",
    `
      <h3>Оплата по QR коду</h3>
      <div style="margin-top:10px; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%;">
        <p>Мерчант: ${merchantId}</p>
        <p>Сумма: ${amount} ₲</p>
        <p>Назначение: ${purpose}</p>
        <button id="confirmPayBtn">Оплатить</button>
      </div>
    `
  );
  openModal("confirmMerchantPayModal");

  document.getElementById("confirmPayBtn").onclick = async () => {
    if (!currentUserId) return;
    try {
      const resp = await fetch(`${API_URL}/payMerchantOneTime`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, merchantId, amount, purpose }),
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

/* ===================================
   UNIVERSAL QR СКАНИРОВАНИЕ
==================================== */
function startUniversalQRScanner(videoEl, onSuccess) {
  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: "environment" } })
    .then((stream) => {
      videoEl.srcObject = stream;
      videoEl.play();
      if ("BarcodeDetector" in window) {
        // Используем API BarcodeDetector
        const detector = new BarcodeDetector({ formats: ["qr_code"] });
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
            console.error("BarcodeDetector detect:", err);
            requestAnimationFrame(scanFrame);
          }
        };
        requestAnimationFrame(scanFrame);
      } else {
        // Fallback на jsQR
        console.log("BarcodeDetector не поддерживается, fallback jsQR.");
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const scanFrame = () => {
          if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
            canvas.width = videoEl.videoWidth;
            canvas.height = videoEl.videoHeight;
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            });
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
    .catch((err) => {
      console.error("Ошибка доступа к камере:", err);
    });
}

function stopVideoStream(videoEl) {
  const stream = videoEl.srcObject;
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
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
   ОБМЕН ВАЛЮТЫ (КУРС, ГРАФИК)
==================================== */
let currentExchangeDirection = "coin_to_rub"; 
let currentExchangeRate = 0;

async function openExchangeModal() {
  showGlobalLoading();
  createModal(
    "exchangeModal",
    `
      <style>
        .exchange-container {
          max-width:600px; 
          margin:0 auto; 
          padding:20px; 
          background-color:transparent; 
          max-height:80vh; 
          overflow-y:auto; 
        }
        .main-header {
          text-align:center; 
          font-size:24px; 
          font-weight:bold; 
          margin-bottom:20px; 
        }
        .exchange-header h3 {
          text-align:center; 
          margin-bottom:50px; 
          font-size:16px; 
          font-weight:normal; 
        }
        .exchange-body {
          display:flex; 
          flex-direction:column; 
          align-items:center; 
        }
        .exchange-row {
          display:flex; 
          justify-content:center; 
          align-items:center; 
          width:100%; 
          margin-bottom:20px; 
        }
        .fromSection, .toSection {
          flex:1; 
          max-width:45%; 
          text-align:center; 
        }
        .swap-container {
          width:60px; 
          display:flex; 
          justify-content:center; 
          align-items:center; 
        }
        .currency-box {
          display:flex; 
          align-items:center; 
          justify-content:center; 
          margin-bottom:10px; 
        }
        .currency-icon {
          width:40px; 
          height:40px; 
          margin-right:10px; 
          border:none; 
        }
        .currency-name {
          font-weight:bold; 
          font-size:18px; 
        }
        .currency-description {
          font-size:14px; 
          color:gray; 
        }
        .amount-box { text-align:center; }
        .currency-input {
          width:100%; 
          padding:10px; 
          margin-bottom:10px; 
          font-size:16px; 
          border:none; 
          border-radius:5px; 
          background:transparent; 
        }
        .swap-btn {
          background-color:transparent; 
          border:none; 
          cursor:pointer; 
          border:1px #fff; 
        }
        .swap-btn img { 
          border:none; 
          width:20px; 
          height:20px; 
        }
        #swapBtn {
          background:none; 
          border:none; 
          padding:0; 
          cursor:pointer; 
          margin-top:50px; 
        }
        .exchange-btn {
          background-color:transparent; 
          color:#28a745; 
          padding:15px 30px; 
          border:2px solid #000; 
          cursor:pointer; 
          font-size:16px; 
        }
        #exchangeChart {
          width:100%; 
          height:300px; 
        }
        .btn-container { 
          width:100%; 
          text-align:center; 
          margin-top:0px; 
        }
      </style>
      <div class="exchange-container">
        <div class="main-header">Обменять</div>
        <div id="exchangeChartContainer" style="width:100%;max-width:600px; margin:0 auto;">
          <canvas id="exchangeChart"></canvas>
        </div>
        <div class="exchange-header">
          <h3 id="currentRateDisplay">Курс обмена: --</h3>
        </div>
        <div class="exchange-body">
          <div class="exchange-row">
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
            <div class="swap-container">
              <button id="swapBtn" class="swap-btn" onclick="swapCurrencies()">
                <img src="24.png" alt="Swap" style="width:20px; height:20px;">
              </button>
            </div>
            <div class="toSection" id="toSection">
              <div class="currency-box">
                <img id="toIcon" src="18.png" alt="RUB" class="currency-icon">
                <div>
                  <p class="currency-name" id="toCurrencyName">RUB</p>
                  <p class="currency-description" id="toCurrencyDesc">Рубль</p>
                </div>
              </div>
              <div class="amount-box">
                <input type="text" id="toAmount" placeholder="Получить" class="currency-input" disabled>
                <p id="toBalanceInfo">0.00 ₽</p>
              </div>
            </div>
          </div>
          <div class="btn-container">
            <button id="btnPerformExchange" class="exchange-btn">Обменять</button>
          </div>
        </div>
      </div>
    `
  );
  openModal("exchangeModal");

  currentExchangeDirection = "coin_to_rub";
  updateCurrencyLabels();

  try {
    await loadBalanceAndExchangeRate();
    updateCurrentRateDisplay();
    drawExchangeChart();
    document
      .getElementById("btnPerformExchange")
      .addEventListener("click", function () {
        handleExchange(currentExchangeDirection);
      });
  } catch (error) {
    console.error("Ошибка при загрузке данных обмена:", error);
  } finally {
    hideGlobalLoading();
  }
}

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
    // Монеты -> рубли
    result = amount * currentExchangeRate;
    toAmount.value = result.toFixed(2);
  } else {
    // Рубли -> монеты
    result = amount / currentExchangeRate;
    toAmount.value = result.toFixed(5);
  }
}

function swapCurrencies() {
  currentExchangeDirection =
    currentExchangeDirection === "coin_to_rub" ? "rub_to_coin" : "coin_to_rub";
  updateCurrencyLabels();
  document.getElementById("amountInput").value = "";
  document.getElementById("toAmount").value = "";
  loadBalanceAndExchangeRate();
}

function updateCurrencyLabels() {
  if (currentExchangeDirection === "coin_to_rub") {
    document.getElementById("fromCurrencyName").textContent = "GUGA";
    document.getElementById("fromCurrencyDesc").textContent = "GugaCoin";
    document.getElementById("fromIcon").src = "15.png";

    document.getElementById("toCurrencyName").textContent = "RUB";
    document.getElementById("toCurrencyDesc").textContent = "Рубль";
    document.getElementById("toIcon").src = "18.png";
  } else {
    document.getElementById("fromCurrencyName").textContent = "RUB";
    document.getElementById("fromCurrencyDesc").textContent = "Рубль";
    document.getElementById("fromIcon").src = "18.png";

    document.getElementById("toCurrencyName").textContent = "GUGA";
    document.getElementById("toCurrencyDesc").textContent = "GugaCoin";
    document.getElementById("toIcon").src = "15.png";
  }
}

async function handleExchange(direction) {
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

  // Ограничение на «цикличные операции» подряд
  if (lastDirection !== null && lastDirection === direction) {
    alert("Цикличные операции запрещены. Попробуйте другую операцию или подождите.");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/exchange`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction, amount }),
    });
    const data = await response.json();
    if (data.success) {
      // Обновим UI
      const newRate = parseFloat(data.currentratedisplay).toFixed(2);
      document.getElementById(
        "currentRateDisplay"
      ).textContent = `Курс обмена: 1 ₲ = ${newRate} ₽`;
      await loadBalanceAndExchangeRate();

      let exchangeMessage = "";
      if (direction === "rub_to_coin") {
        exchangeMessage = `Вы обменяли ${amount} ₽ на ${parseFloat(
          data.exchanged_amount
        ).toFixed(5)} ₲`;
      } else {
        exchangeMessage = `Вы обменяли ${amount} ₲ на ${parseFloat(
          data.exchanged_amount
        ).toFixed(2)} ₽`;
      }
      alert(`✅ Обмен выполнен успешно!\n${exchangeMessage}`);

      lastDirection = direction;
      // Через 5 секунд «сбрасываем» lastDirection
      setTimeout(() => {
        lastDirection = null;
      }, 5000);
    } else {
      alert("Ошибка обмена: " + data.error);
    }
  } catch (error) {
    console.error("Ошибка при обмене:", error);
    alert("Произошла ошибка при обмене");
  }
}

async function loadBalanceAndExchangeRate() {
  // Обновляем баланс пользователя под текущую операцию
  try {
    const response = await fetch(`${API_URL}/user`, { credentials: "include" });
    const data = await response.json();
    if (data.success && data.user) {
      currentUserId = data.user.user_id;
      // Отображаем баланс, в зависимости от направления
      if (currentExchangeDirection === "coin_to_rub") {
        const coinBalance = data.user.balance || 0;
        document.getElementById("balanceInfo").textContent = `${coinBalance.toFixed(
          5
        )} ₲`;
        document.getElementById("toBalanceInfo").textContent = `${(
          data.user.rub_balance || 0
        ).toFixed(2)} ₽`;
      } else {
        const rubBalance = data.user.rub_balance || 0;
        document.getElementById("balanceInfo").textContent = `${rubBalance.toFixed(
          2
        )} ₽`;
        document.getElementById("toBalanceInfo").textContent = `${(
          data.user.balance || 0
        ).toFixed(5)} ₲`;
      }
    }
  } catch (error) {
    console.error("Ошибка при загрузке данных пользователя:", error);
  }

  // Загружаем историю обменных курсов (для графика)
  try {
    const rateResp = await fetch(`${API_URL}/exchangeRates?limit=200`, {
      credentials: "include",
    });
    const rateData = await rateResp.json();
    if (rateData.success && rateData.rates && rateData.rates.length > 0) {
      drawExchangeChart(rateData.rates);
      const latestRate = parseFloat(rateData.rates[0].exchange_rate);
      currentExchangeRate = latestRate;
      const rateEl = document.getElementById("currentRateDisplay");
      rateEl.textContent = `Курс обмена: 1 ₲ = ${latestRate.toFixed(2)} ₽`;
    } else {
      document.getElementById("currentRateDisplay").textContent =
        "Курс обмена: Данные отсутствуют";
      console.log("Нет данных для графика обмена");
    }
  } catch (error) {
    console.error("Ошибка при загрузке курса:", error);
  }
}

function updateCurrentRateDisplay() {
  const el = document.getElementById("currentRateDisplay");
  if (!el) return;
  el.textContent = currentExchangeRate
    ? `Курс обмена: 1 ₲ = ${currentExchangeRate.toFixed(2)} ₽`
    : "Курс обмена: --";
}

function drawExchangeChart(rates) {
  if (!rates || !Array.isArray(rates) || rates.length === 0) {
    console.error("Отсутствуют данные для графика");
    return;
  }
  const sortedRates = rates
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  if (exchangeChartInstance) {
    exchangeChartInstance.destroy();
  }
  const labels = sortedRates.map((rate) => {
    const d = new Date(rate.created_at);
    return (
      d.getHours().toString().padStart(2, "0") +
      ":" +
      d.getMinutes().toString().padStart(2, "0")
    );
  });
  const dataPoints = sortedRates.map((rate) =>
    parseFloat(rate.exchange_rate)
  );

  const ctx = document.getElementById("exchangeChart").getContext("2d");
  exchangeChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Курс обмена",
          data: dataPoints,
          fill: false,
          borderColor: "green",
          tension: 0.5,
          pointRadius: 0,
          borderCapStyle: "round",
        },
      ],
    },
    options: {
      layout: { padding: 0 },
      scales: {
        x: {
          grid: {
            display: false,
            drawBorder: false,
            drawTicks: false,
            borderColor: "transparent",
            borderWidth: 0,
          },
          ticks: { display: false },
        },
        y: {
          position: "right",
          grid: {
            display: true,
            drawBorder: false,
            drawTicks: false,
            borderColor: "transparent",
            borderWidth: 0,
            color: "rgba(0,0,0,0.1)",
          },
          ticks: { beginAtZero: false },
        },
      },
      plugins: {
        legend: { display: false },
      },
    },
  });
}

/* ===================================
   МАЙНИНГ
==================================== */
function mineCoins() {
  let locBalance = parseFloat(localStorage.getItem("localBalance")) || 0;
  locBalance += 0.00001;
  updateBalanceDisplay(locBalance);
  localStorage.setItem("localBalance", locBalance.toFixed(5));

  let pmc = parseFloat(localStorage.getItem("pendingMinedCoins")) || 0;
  pmc += 0.00001;
  localStorage.setItem("pendingMinedCoins", pmc.toFixed(5));

  if (mineTimer) clearTimeout(mineTimer);
  mineTimer = setTimeout(() => {
    isMining = false;
    flushMinedCoins();
  }, 1500);
}

function updateBalanceDisplay(localBalance) {
  const balanceValue = document.getElementById("balanceValue");
  if (balanceValue) {
    balanceValue.textContent = `${localBalance.toFixed(5)} ₲`;
  }
}

async function flushMinedCoins() {
  let pmc = parseFloat(localStorage.getItem("pendingMinedCoins")) || 0;
  if (!currentUserId || pmc <= 0) return;
  try {
    const resp = await fetch(`${API_URL}/update`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: pmc }),
    });
    if (!resp.ok) throw new Error(`Сервер ответил статусом ${resp.status}`);
    pmc = 0;
    localStorage.setItem("pendingMinedCoins", pmc);
    fetchUserData();
  } catch (err) {
    console.error("Ошибка flushMinedCoins:", err);
  }
}

/* ===================================
   ГЛОБАЛЬНЫЙ ИНДИКАТОР ЗАГРУЗКИ
==================================== */
let loadingRequests = 0;
function showGlobalLoading() {
  loadingRequests++;
  const loader = document.getElementById("loadingIndicator");
  if (loader) loader.style.display = "flex";
}
function hideGlobalLoading() {
  loadingRequests--;
  if (loadingRequests <= 0) {
    loadingRequests = 0;
    const loader = document.getElementById("loadingIndicator");
    if (loader) loader.style.display = "none";
  }
}

/* ===================================
   ДАННЫЕ ПОЛЬЗОВАТЕЛЯ
==================================== */
async function fetchUserData() {
  try {
    const response = await fetch(`${API_URL}/user`, { credentials: "include" });
    const data = await response.json();
    if (data.success && data.user) {
      currentUserId = data.user.user_id;
      // Обновляем баланс на экране
      const coinBalance = data.user.balance || 0;
      const rubBalance = data.user.rub_balance || 0;

      // Отображаем в #balanceValue
      const balanceVal = document.getElementById("balanceValue");
      if (balanceVal) {
        balanceVal.textContent = `${coinBalance.toFixed(5)} ₲`;
      }

      // Отображаем рублевый баланс, если есть отдельный элемент
      const rubBalanceInfo = document.getElementById("rubBalanceInfo");
      if (rubBalanceInfo) {
        rubBalanceInfo.textContent = `${rubBalance.toFixed(2)} ₽`;
      }

      // Также обновим поле ID под балансом
      const userIdEl = document.getElementById("userIdDisplay");
      if (userIdEl) {
        userIdEl.textContent = `ID: ${currentUserId}`;
      }
    }
  } catch (error) {
    console.error("Ошибка загрузки данных пользователя:", error);
  }
}

/* ===================================
   ИСТОРИЯ ОПЕРАЦИЙ
==================================== */
function openHistoryModal() {
  createModal(
    "historyModal",
    `
      <h3>История операций</h3>
      <div class="scrollable-content">
        <ul id="transactionList"></ul>
      </div>
    `
  );
  openModal("historyModal");
  fetchTransactionHistory();
}

async function fetchTransactionHistory() {
  if (!currentUserId) return;
  try {
    showGlobalLoading();
    const resp = await fetch(
      `${API_URL}/transactions?userId=${currentUserId}`,
      { credentials: "include" }
    );
    const data = await resp.json();
    if (resp.ok && data.success && data.transactions) {
      displayTransactionHistory(data.transactions);
    } else {
      console.error("Ошибка получения истории:", data.error);
    }
  } catch (err) {
    console.error("Ошибка fetchTransactionHistory:", err);
  } finally {
    hideGlobalLoading();
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
  transactions.forEach((tx) => {
    const d = new Date(tx.client_time || tx.created_at);
    const label = getDateLabel(d);
    if (!groups[label]) groups[label] = [];
    groups[label].push(tx);
  });

  // Сортируем группы по убыванию даты
  const sortedDates = Object.keys(groups).sort((a, b) => {
    const dateA = new Date(groups[a][0].client_time || groups[a][0].created_at);
    const dateB = new Date(groups[b][0].client_time || groups[b][0].created_at);
    return dateB - dateA;
  });

  sortedDates.forEach((dateStr) => {
    const groupDiv = document.createElement("div");
    groupDiv.className = "history-group";

    const dateHeader = document.createElement("div");
    dateHeader.className = "history-date";
    dateHeader.textContent = dateStr;
    groupDiv.appendChild(dateHeader);

    groups[dateStr].forEach((tx) => {
      const op = document.createElement("div");
      op.className = "history-item";
      const timeStr = new Date(
        tx.client_time || tx.created_at
      ).toLocaleTimeString("ru-RU");

      let opHTML = "";
      if (tx.type === "exchange") {
        // Обмен
        const rate = tx.exchange_rate ? Number(tx.exchange_rate) : null;
        let credited = "N/A";
        if (rate) {
          credited =
            tx.direction === "rub_to_coin"
              ? (tx.amount / rate).toFixed(5) + " ₲"
              : (tx.amount * rate).toFixed(2) + " ₽";
        }
        opHTML = `
          <div>Обмен валюты 💱</div>
          <div>Направление: ${
            tx.direction === "rub_to_coin" ? "Рубли → Монеты" : "Монеты → Рубли"
          }</div>
          <div>Сумма списания: ${
            tx.direction === "rub_to_coin"
              ? tx.amount + " ₽"
              : tx.amount + " ₲"
          }</div>
          <div>Сумма зачисления: ${credited}</div>
          <div>Курс: 1 ₲ = ${
            rate ? rate.toFixed(2) : "N/A"
          } ₽</div>
          <div>Время операции: ${timeStr}</div>
        `;
      } else if (tx.type === "merchant_payment") {
        // Оплата мерчанту
        opHTML = `
          <div>Оплата по QR 💳</div>
          <div>Мерчант: ${
            tx.merchant_id ||
            (tx.to_user_id && tx.to_user_id.replace("MERCHANT:", "")) ||
            "???"
          }</div>
          <div>Сумма: ₲ ${tx.amount}</div>
          <div>Время операции: ${timeStr}</div>
        `;
      } else if (tx.from_user_id === currentUserId) {
        // Исходящая
        opHTML = `
          <div>Исходящая операция ⤴</div>
          <div>Кому: ${tx.to_user_id}</div>
          <div>Сумма: ₲ ${formatBalance(tx.amount)}</div>
          <div>Время операции: ${timeStr}</div>
        `;
      } else if (tx.to_user_id === currentUserId) {
        // Входящая
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

/* Функция для показа "Сегодня"/"Вчера"/дата */
function getDateLabel(dateObj) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dateObj.toDateString() === today.toDateString()) return "Сегодня";
  if (dateObj.toDateString() === yesterday.toDateString()) return "Вчера";
  return dateObj.toLocaleDateString("ru-RU");
}

/* ===================================
   UI МЕРЧАНТА (если вход как мерчант)
==================================== */
async function openMerchantUI() {
  // Если currentMerchantId не известен — попробуем получить
  if (!currentMerchantId) {
    await fetchMerchantInfo();
    if (!currentMerchantId) {
      alert("Ошибка: мерчант не авторизован");
      return;
    }
  }
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
    <p>Баланс: <span id="merchantBalanceValue">${merchantBalance.toFixed(5)}</span> ₲</p>
    <div class="merchant-buttons" style="display: flex; gap: 10px; margin-top: 20px;">
      <button id="merchantCreateQRBtn" class="btn btn-primary">Создать QR</button>
      <button id="merchantTransferBtn" class="btn btn-primary">Перевести</button>
      <button id="merchantLogoutBtn" class="btn btn-primary">Выйти</button>
    </div>
    <div id="merchantQRContainer" style="margin-top: 40px;"></div>
  `;
  document.body.appendChild(merchDiv);

  // Привязываем события
  document
    .getElementById("merchantCreateQRBtn")
    .addEventListener("click", openOneTimeQRModal);
  document
    .getElementById("merchantTransferBtn")
    .addEventListener("click", openMerchantTransferModal);
  document.getElementById("merchantLogoutBtn").addEventListener("click", logout);

  // Обновим данные
  fetchMerchantData();
}

async function fetchMerchantInfo() {
  try {
    const resp = await fetch(`${API_URL}/merchant/info`, {
      credentials: "include",
    });
    const data = await resp.json();
    if (resp.ok && data.success && data.merchant) {
      currentMerchantId = data.merchant.merchant_id;
      merchantBalance = parseFloat(data.merchant.balance) || 0;
    } else {
      console.log("Не удалось получить info мерчанта:", data.error);
    }
  } catch (err) {
    console.log("Ошибка fetchMerchantInfo:", err);
  }
}

async function fetchMerchantData() {
  // Обновим баланс мерчанта
  await fetchMerchantBalance();
  // Получим halvingInfo
  try {
    const resp = await fetch(`${API_URL}/halvingInfo`, { credentials: "include" });
    const data = await resp.json();
    if (resp.ok && data.success) {
      currentHalvingStep = data.halvingStep || 0;
    }
  } catch (err) {
    console.log("Ошибка получения halvingInfo:", err);
  }
}

async function fetchMerchantBalance() {
  if (!currentMerchantId) return;
  try {
    const resp = await fetch(
      `${API_URL}/merchantBalance?merchantId=${currentMerchantId}`,
      { credentials: "include" }
    );
    const data = await resp.json();
    if (resp.ok && data.success) {
      merchantBalance = parseFloat(data.balance) || 0;
      const mb = document.getElementById("merchantBalanceValue");
      if (mb) mb.textContent = merchantBalance.toFixed(5);
    } else {
      alert("❌ Ошибка при получении баланса мерчанта: " + (data.error || ""));
    }
  } catch (err) {
    console.error("Сбой fetchMerchantBalance:", err);
  }
}

/* Модалка "Создать QR на оплату" */
function openOneTimeQRModal() {
  createModal(
    "createOneTimeQRModal",
    `
      <h3>Создать запрос на оплату</h3>
      <label for="qrAmountInput">Сумма (₲):</label>
      <input type="number" id="qrAmountInput" step="0.00001" placeholder="Введите сумму" style="width:100%; max-width:200px; margin:5px 0;" oninput="calcRubEquivalent()">
      <p id="qrRubEquivalent"></p>
      <label for="qrPurposeInput">Назначение:</label>
      <input type="text" id="qrPurposeInput" placeholder="Например, заказ #123" style="width:100%; max-width:200px; margin:5px 0;">
      <button id="createQRBtn" class="btn btn-primary" style="margin-top:15px;">Создать</button>
    `
  );
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
  const eqEl = document.getElementById("qrRubEquivalent");
  if (eqEl) eqEl.textContent = `≈ ${rubVal.toFixed(2)} RUB`;
}

function createMerchantQR(amount, purpose) {
  const qrData = `guga://merchantId=${currentMerchantId}&amount=${amount}&purpose=${encodeURIComponent(
    purpose
  )}`;
  createModal(
    "merchantQRModal",
    `
      <div id="merchantQRModalContainer"></div>
      <p style="margin-top:15px; font-weight:bold;">Запрашиваемая сумма: ${amount} ₲</p>
    `
  );
  openModal("merchantQRModal");

  // Если QRCode() доступен
  if (typeof QRCode === "function") {
    const container = document.getElementById("merchantQRModalContainer");
    if (container) {
      const qrElem = document.createElement("div");
      container.appendChild(qrElem);
      new QRCode(qrElem, {
        text: qrData,
        width: 280,
        height: 250,
        correctLevel: QRCode.CorrectLevel.L,
      });
    }
  } else {
    // Если нет библиотеки QRCode
    const c = document.getElementById("merchantQRModalContainer");
    if (c) c.innerHTML = `QR Data: ${qrData}`;
  }
  monitorPayment(qrData, amount);
}

/* Периодическая проверка оплаты */
function monitorPayment(qrData, amount) {
  const checkInterval = setInterval(async () => {
    try {
      const response = await fetch(
        `${API_URL}/checkPaymentStatus?merchantId=${currentMerchantId}&qrData=${encodeURIComponent(
          qrData
        )}`,
        { credentials: "include" }
      );
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

/* Модалка "Перевести" (мерчант -> пользователь) */
function openMerchantTransferModal() {
  createModal(
    "merchantTransferModal",
    `
      <h3>Перевести на пользователя</h3>
      <label for="merchantToUserIdInput">Кому (ID):</label>
      <input type="text" id="merchantToUserIdInput" placeholder="Введите ID" style="width:100%; max-width:200px; margin:5px 0;">
      <label for="merchantTransferAmountInput">Сумма (₲):</label>
      <input type="number" id="merchantTransferAmountInput" step="0.00001" placeholder="Сумма" style="width:100%; max-width:200px; margin:5px 0;">
      <button id="merchantTransferSendBtn" class="btn btn-primary" style="margin-top:15px;">Отправить</button>
    `
  );
  openModal("merchantTransferModal");

  document.getElementById("merchantTransferSendBtn").onclick = async () => {
    const toUser = document.getElementById("merchantToUserIdInput")?.value;
    const amt = parseFloat(
      document.getElementById("merchantTransferAmountInput")?.value
    );
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
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchantId: currentMerchantId, toUserId, amount }),
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
   ОБНОВЛЕНИЕ / ИНИЦИАЛИЗАЦИЯ UI
==================================== */
function updateUI() {
  // Если у нас есть userId — показываем UI пользователя
  if (currentUserId && !currentMerchantId) {
    createMainUI();
  }
  // Если мерчант
  else if (currentMerchantId) {
    openMerchantUI();
  }
  // Иначе — окно авторизации
  else {
    openAuthModal();
  }
}

// Скрываем все элементы, кроме авторизации, если UI не готов
function hideAll() {
  hideMainUI();
  document.getElementById("merchantInterface")?.remove();
}

document.addEventListener("DOMContentLoaded", () => {
  // При загрузке пытаемся определить, кто мы (пользователь или мерчант)
  fetchUserData().then(() => {
    if (currentMerchantId) {
      openMerchantUI();
    } else if (currentUserId) {
      createMainUI();
    } else {
      openAuthModal();
    }
  });

  // Привязка к кнопке "Майнить" (если есть в HTML)
  const mineBtn = document.getElementById("mineBtn");
  if (mineBtn) {
    mineBtn.addEventListener("click", mineCoins);
  }
});

// Если при закрытии страницы есть непросланные намайненные монеты — отправляем
window.addEventListener("beforeunload", () => {
  if (pendingMinedCoins > 0) {
    flushMinedCoins();
  }
});

/* ===================================
   ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
==================================== */
const API_URL = "https://api.mkntw.ru";

let currentUserId = null;
let currentMerchantId = null;

let pendingMinedCoins = parseFloat(localStorage.getItem("pendingMinedCoins")) || 0;
let localBalance = 0;
let merchantBalance = 0;

let isMining = false;
let mineTimer = null;
let updateInterval = null;

let currentHalvingStep = 0;
let lastDirection = null;
let cycleCount = 0;
let exchangeChartInstance = null;

/* ===================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
==================================== */
function formatBalance(num) {
  return parseFloat(num).toFixed(5);
}

function createModal(id, innerHtml, { showCloseBtn = false } = {}) {
  // Удаляем, если уже был такой
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  // Создаем контейнер-модал
  const modal = document.createElement("div");
  modal.id = id;
  modal.className = "modal hidden";
  // Кнопка закрытия (только если showCloseBtn = true)
  const closeButtonHtml = showCloseBtn
    ? `<button class="close-btn" onclick="closeModal('${id}')">×</button>`
    : "";

  // Вставляем структуру
  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-content">
      ${closeButtonHtml}
      ${innerHtml}
    </div>
  `;
  document.body.appendChild(modal);

  // Закрытие по клику на оверлей — если нужно
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

function openModal(id) {
  document.getElementById(id)?.classList.remove("hidden");
}

function closeModal(id) {
  document.getElementById(id)?.classList.add("hidden");
}

function closeAllModals() {
  document.querySelectorAll(".modal").forEach((m) => m.classList.add("hidden"));
}

/* ===================================
   АВТОРИЗАЦИЯ
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
    // Попытка входа как обычный пользователь
    const userResp = await fetch(`${API_URL}/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: loginVal, password: passVal }),
    });
    const userData = await userResp.json();
    if (userResp.ok && userData.success) {
      // Успешно
      await fetchUserData();
      document.getElementById("authModal")?.remove();
      createMainUI();
      updateUI();
      return;
    } else {
      // Пробуем мерчанта
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
        // Авторизация как мерчант
        await fetchMerchantData();
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
      // Автоматический вход
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
  // Сброс
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

function openAuthModal() {
  hideMainUI();
  document.getElementById("merchantInterface")?.remove();

  let authModal = document.getElementById("authModal");
  if (authModal) authModal.remove();

  authModal = document.createElement("div");
  authModal.id = "authModal";
  authModal.className = "modal hidden";

  authModal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-content" style="max-width:400px; margin:60px auto;">
      <!-- Нет отдельной кнопки закрытия,
           будем закрывать по нажатию на "Главная" или при логине -->
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

  // Событие для overlay
  authModal.querySelector(".modal-overlay").addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-overlay")) {
      // По клику вне контента — ничего (или можно скрывать)
      // authModal.classList.add("hidden");
    }
  });

  // Показываем
  authModal.classList.remove("hidden");

  // События кнопок
  document.getElementById("loginSubmitBtn").addEventListener("click", login);
  document
    .getElementById("registerSubmitBtn")
    .addEventListener("click", register);
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
   ГЛАВНЫЙ ЭКРАН ПОЛЬЗОВАТЕЛЯ
==================================== */
function createMainUI() {
  // Создаём нижнюю панель, если нет
  if (!document.getElementById("bottomBar")) {
    const bottomBar = document.createElement("div");
    bottomBar.id = "bottomBar";
    bottomBar.innerHTML = `
      <button id="btnMain">Главная</button>
      <button id="historyBtn">История</button>
      <button id="exchangeBtn">Обменять</button>
    `;
    document.body.appendChild(bottomBar);

    // При нажатии на главную — скрыть все модалки
    document.getElementById("btnMain").addEventListener("click", () => {
      closeAllModals();
    });
    // При нажатии на историю — скрыть все, открыть history
    document.getElementById("historyBtn").addEventListener("click", () => {
      closeAllModals();
      openHistoryModal();
    });
    // При нажатии на обменять — скрыть все, открыть exchange
    document.getElementById("exchangeBtn").addEventListener("click", () => {
      closeAllModals();
      openExchangeModal();
    });
  }

  // Показываем блоки баланса и майна
  document.getElementById("balanceDisplay")?.classList.remove("hidden");
  document.getElementById("mineContainer")?.classList.remove("hidden");

  // Создаем «Главная» (заголовок), если нужно
  if (!document.getElementById("mainTitle")) {
    const mainTitle = document.createElement("div");
    mainTitle.id = "mainTitle";
    mainTitle.textContent = "Главная";
    document.body.appendChild(mainTitle);
  }

  // Блок с 2 кнопками: "Перевести" + "Оплата по QR"
  if (!document.getElementById("actionButtonsContainer")) {
    const cont = document.createElement("div");
    cont.id = "actionButtonsContainer";
    cont.innerHTML = `
      <button id="transferBtn">Перевести</button>
      <button id="payQRBtn">Оплата по QR</button>
    `;
    document.body.appendChild(cont);

    // При нажатии — сначала скрываем всё
    document.getElementById("transferBtn").addEventListener("click", () => {
      closeAllModals();
      openTransferModal(); // у этого окна есть кнопка закрытия (X)
    });
    document.getElementById("payQRBtn").addEventListener("click", () => {
      closeAllModals();
      openPayQRModal(); // у этого окна есть кнопка закрытия (X)
    });
  }

  // Стартуем обновление
  fetchUserData();
  clearInterval(updateInterval);
  updateInterval = setInterval(fetchUserData, 2000);
}

function hideMainUI() {
  document.getElementById("balanceDisplay")?.classList.add("hidden");
  document.getElementById("mineContainer")?.classList.add("hidden");
  document.getElementById("mainTitle")?.remove();
  document.getElementById("actionButtonsContainer")?.remove();
  clearInterval(updateInterval);
}

/* ===================================
   МОДАЛКА "ПЕРЕВОД"
   (С КНОПКОЙ ЗАКРЫТИЯ)
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
    `,
    { showCloseBtn: true } // <<=== Есть кнопка "X"
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
   МОДАЛКА "ОПЛАТА ПО QR"
   (С КНОПКОЙ ЗАКРЫТИЯ)
==================================== */
function openPayQRModal() {
  createModal(
    "payQRModal",
    `
      <h3>Оплата по QR</h3>
      <div style="margin-top:20px; display:flex; flex-direction:column; align-items:center; width:90%;max-width:500px;">
        <video id="opPayVideo" muted playsinline style="width:100%; max-width:600px; border:2px solid black;"></video>
      </div>
    `,
    { showCloseBtn: true } // <<=== Есть кнопка "X"
  );
  openModal("payQRModal");

  const videoEl = document.getElementById("opPayVideo");
  startUniversalQRScanner(videoEl, (rawValue) => {
    closeModal("payQRModal");
    const parsed = parseMerchantQRData(rawValue);
    if (!parsed.merchantId) {
      alert("❌ Не удалось извлечь merchantId");
      return;
    }
    confirmPayMerchantModal(parsed);
  });
}

function confirmPayMerchantModal({ merchantId, amount, purpose }) {
  createModal(
    "confirmPayMerchantModal",
    `
      <h3>Подтверждение оплаты</h3>
      <div style="margin-top:10px; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%;">
        <p>Мерчант: ${merchantId}</p>
        <p>Сумма: ${amount} ₲</p>
        <p>Назначение: ${purpose}</p>
        <button id="confirmPayBtn">Оплатить</button>
      </div>
    `,
    { showCloseBtn: true } // Можно и без кнопки, но пусть будет
  );
  openModal("confirmPayMerchantModal");

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
        closeModal("confirmPayMerchantModal");
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
   UNIVERSAL QR СКАН
==================================== */
function startUniversalQRScanner(videoEl, onSuccess) {
  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: "environment" } })
    .then((stream) => {
      videoEl.srcObject = stream;
      videoEl.play();
      if ("BarcodeDetector" in window) {
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
        // fallback jsQR
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
    stream.getTracks().forEach((t) => t.stop());
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
   ОБМЕН ВАЛЮТЫ
==================================== */
let currentExchangeDirection = "coin_to_rub";
let currentExchangeRate = 0;

async function openExchangeModal() {
  showGlobalLoading();
  // Закрываем все предыдущие — согласно пожеланию
  closeAllModals();

  createModal(
    "exchangeModal",
    `
      <div class="exchange-container" style="margin-top:20px;">
        <h3>Обмен</h3>
        <div id="exchangeChartContainer" style="width:100%; max-width:600px; margin:0 auto;">
          <canvas id="exchangeChart"></canvas>
        </div>
        <h4 id="currentRateDisplay">Курс обмена: --</h4>
        <div class="exchange-body" style="margin-top:20px;">
          <div class="exchange-row" style="display:flex;justify-content:center;align-items:center;gap:10px;">
            <div style="flex:1;text-align:center;">
              <p id="fromLabel">GUGA</p>
              <input type="number" id="amountInput" placeholder="0.00" oninput="updateExchange()">
              <p id="balanceInfo">0.00000 ₲</p>
            </div>
            <button id="swapBtn">⇄</button>
            <div style="flex:1;text-align:center;">
              <p id="toLabel">RUB</p>
              <input type="text" id="toAmount" placeholder="0.00" disabled>
              <p id="toBalanceInfo">0.00 ₽</p>
            </div>
          </div>
          <button id="btnPerformExchange" style="margin-top:20px;">Обменять</button>
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
      .addEventListener("click", () => handleExchange(currentExchangeDirection));
    document.getElementById("swapBtn").onclick = () => {
      swapCurrencies();
    };
  } catch (error) {
    console.error("Ошибка при открытии обмена:", error);
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
    result = amount * currentExchangeRate;
    toAmount.value = result.toFixed(2);
  } else {
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
  const fromLabel = document.getElementById("fromLabel");
  const toLabel = document.getElementById("toLabel");

  if (currentExchangeDirection === "coin_to_rub") {
    if (fromLabel) fromLabel.textContent = "GUGA";
    if (toLabel) toLabel.textContent = "RUB";
  } else {
    if (fromLabel) fromLabel.textContent = "RUB";
    if (toLabel) toLabel.textContent = "GUGA";
  }
}

async function handleExchange(direction) {
  const amount = parseFloat(document.getElementById("amountInput").value);
  if (isNaN(amount) || amount <= 0) {
    alert("Введите корректную сумму");
    return;
  }
  // Анти-цикл
  if (lastDirection === direction) {
    alert("Нельзя выполнять одинаковые операции подряд. Подождите или поменяйте направление.");
    return;
  }
  try {
    const resp = await fetch(`${API_URL}/exchange`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction, amount }),
    });
    const data = await resp.json();
    if (data.success) {
      // Обновим UI
      await loadBalanceAndExchangeRate();
      let msg = "";
      if (direction === "rub_to_coin") {
        msg = `Обмен: ${amount} ₽ → ${parseFloat(data.exchanged_amount).toFixed(5)} ₲`;
      } else {
        msg = `Обмен: ${amount} ₲ → ${parseFloat(data.exchanged_amount).toFixed(2)} ₽`;
      }
      alert("✅ " + msg);
      lastDirection = direction;
      setTimeout(() => {
        lastDirection = null;
      }, 5000);
    } else {
      alert("❌ Ошибка обмена: " + data.error);
    }
  } catch (err) {
    console.error("Ошибка обмена:", err);
    alert("Произошла ошибка при обмене");
  }
}

async function loadBalanceAndExchangeRate() {
  try {
    const resp = await fetch(`${API_URL}/user`, { credentials: "include" });
    const data = await resp.json();
    if (data.success && data.user) {
      currentUserId = data.user.user_id;
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
    console.error("Ошибка загрузки пользователя:", error);
  }

  try {
    const rateResp = await fetch(`${API_URL}/exchangeRates?limit=200`, {
      credentials: "include",
    });
    const rateData = await rateResp.json();
    if (rateData.success && rateData.rates?.length) {
      drawExchangeChart(rateData.rates);
      currentExchangeRate = parseFloat(rateData.rates[0].exchange_rate);
      document.getElementById(
        "currentRateDisplay"
      ).textContent = `Курс: 1 ₲ = ${currentExchangeRate.toFixed(2)} ₽`;
    }
  } catch (error) {
    console.error("Ошибка при загрузке курса:", error);
  }
}

function updateCurrentRateDisplay() {
  const el = document.getElementById("currentRateDisplay");
  if (el) {
    el.textContent = currentExchangeRate
      ? `Курс: 1 ₲ = ${currentExchangeRate.toFixed(2)} ₽`
      : "Курс: --";
  }
}

function drawExchangeChart(rates) {
  if (!rates || !rates.length) return;
  if (exchangeChartInstance) exchangeChartInstance.destroy();

  const sorted = [...rates].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );
  const labels = sorted.map((r) => {
    const d = new Date(r.created_at);
    return (
      d.getHours().toString().padStart(2, "0") +
      ":" +
      d.getMinutes().toString().padStart(2, "0")
    );
  });
  const dataPoints = sorted.map((r) => parseFloat(r.exchange_rate));

  const ctx = document.getElementById("exchangeChart").getContext("2d");
  exchangeChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Курс",
          data: dataPoints,
          borderColor: "green",
          fill: false,
          tension: 0.4,
          pointRadius: 0,
        },
      ],
    },
    options: {
      scales: {
        x: { display: false },
        y: { position: "right" },
      },
      plugins: { legend: { display: false } },
    },
  });
}

/* ===================================
   МАЙНИНГ
==================================== */
function mineCoins() {
  let locBal = parseFloat(localStorage.getItem("localBalance")) || 0;
  locBal += 0.00001;
  updateBalanceDisplay(locBal);
  localStorage.setItem("localBalance", locBal.toFixed(5));

  let pmc = parseFloat(localStorage.getItem("pendingMinedCoins")) || 0;
  pmc += 0.00001;
  localStorage.setItem("pendingMinedCoins", pmc.toFixed(5));

  if (mineTimer) clearTimeout(mineTimer);
  mineTimer = setTimeout(() => {
    isMining = false;
    flushMinedCoins();
  }, 1500);
}

function updateBalanceDisplay(num) {
  const balVal = document.getElementById("balanceValue");
  if (balVal) {
    balVal.textContent = `${num.toFixed(5)} ₲`;
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
    if (!resp.ok) throw new Error("Сервер вернул ошибку " + resp.status);
    pmc = 0;
    localStorage.setItem("pendingMinedCoins", pmc);
    fetchUserData();
  } catch (err) {
    console.error("Ошибка при отправке намайненных монет:", err);
  }
}

/* ===================================
   ЗАГРУЗКА / ИСТОРИЯ
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

async function fetchUserData() {
  try {
    const resp = await fetch(`${API_URL}/user`, { credentials: "include" });
    const data = await resp.json();
    if (data.success && data.user) {
      currentUserId = data.user.user_id;
      const coinBalance = data.user.balance || 0;
      const rubBalance = data.user.rub_balance || 0;
      const balVal = document.getElementById("balanceValue");
      if (balVal) balVal.textContent = `${coinBalance.toFixed(5)} ₲`;

      const rubBal = document.getElementById("rubBalanceInfo");
      if (rubBal) rubBal.textContent = `${rubBalance.toFixed(2)} ₽`;

      // Отображаем ID под балансом
      const userIdEl = document.getElementById("userIdDisplay");
      if (userIdEl) {
        userIdEl.textContent = `ID: ${currentUserId}`;
      }
    }
  } catch (err) {
    console.error("Ошибка fetchUserData:", err);
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
      <div class="scrollable-content" style="height:calc(100vh - 200px);overflow-y:auto;">
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
    const resp = await fetch(`${API_URL}/transactions?userId=${currentUserId}`, {
      credentials: "include",
    });
    const data = await resp.json();
    if (resp.ok && data.success && data.transactions) {
      displayTransactionHistory(data.transactions);
    } else {
      console.error("Ошибка истории:", data.error);
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
  const groups = {};
  transactions.forEach((tx) => {
    const d = new Date(tx.client_time || tx.created_at);
    const label = getDateLabel(d);
    if (!groups[label]) groups[label] = [];
    groups[label].push(tx);
  });

  const sortedDates = Object.keys(groups).sort((a, b) => {
    const dA = new Date(groups[a][0].client_time || groups[a][0].created_at);
    const dB = new Date(groups[b][0].client_time || groups[b][0].created_at);
    return dB - dA;
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
            tx.direction === "rub_to_coin" ? tx.amount + " ₽" : tx.amount + " ₲"
          }</div>
          <div>Сумма зачисления: ${credited}</div>
          <div>Курс: 1 ₲ = ${rate ? rate.toFixed(2) : "N/A"} ₽</div>
          <div>Время: ${timeStr}</div>
        `;
      } else if (tx.type === "merchant_payment") {
        opHTML = `
          <div>Оплата по QR 💳</div>
          <div>Мерчант: ${
            tx.merchant_id ||
            (tx.to_user_id && tx.to_user_id.replace("MERCHANT:", "")) ||
            "???"
          }</div>
          <div>Сумма: ₲ ${tx.amount}</div>
          <div>Время: ${timeStr}</div>
        `;
      } else if (tx.from_user_id === currentUserId) {
        opHTML = `
          <div>Исходящая операция ⤴</div>
          <div>Кому: ${tx.to_user_id}</div>
          <div>Сумма: ₲ ${formatBalance(tx.amount)}</div>
          <div>Время: ${timeStr}</div>
        `;
      } else if (tx.to_user_id === currentUserId) {
        opHTML = `
          <div>Входящая операция ⤵</div>
          <div>От кого: ${tx.from_user_id}</div>
          <div>Сумма: ₲ ${formatBalance(tx.amount)}</div>
          <div>Время: ${timeStr}</div>
        `;
      } else {
        opHTML = `
          <div>Операция</div>
          <div>Сумма: ₲ ${formatBalance(tx.amount || 0)}</div>
          <div>Время: ${timeStr}</div>
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
   МЕРЧАНТ (НЕ ТРОГАЛИ СИЛЬНО)
==================================== */
async function openMerchantUI() {
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

  document
    .getElementById("merchantCreateQRBtn")
    .addEventListener("click", openOneTimeQRModal);
  document
    .getElementById("merchantTransferBtn")
    .addEventListener("click", openMerchantTransferModal);
  document.getElementById("merchantLogoutBtn").addEventListener("click", logout);

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
    }
  } catch (err) {
    console.error("Ошибка получения merchantInfo:", err);
  }
}

async function fetchMerchantData() {
  await fetchMerchantBalance();
  try {
    const resp = await fetch(`${API_URL}/halvingInfo`, { credentials: "include" });
    const halvingData = await resp.json();
    if (resp.ok && halvingData.success) {
      currentHalvingStep = halvingData.halvingStep || 0;
    }
  } catch (err) {
    console.error("Ошибка получения halvingInfo:", err);
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
      alert("Ошибка баланса мерчанта: " + (data.error || ""));
    }
  } catch (err) {
    console.error("Сбой fetchMerchantBalance:", err);
  }
}

/* Модальное окно "Создать запрос на оплату" (мерчант) */
function openOneTimeQRModal() {
  createModal(
    "createOneTimeQRModal",
    `
      <h3>Создать запрос на оплату</h3>
      <label for="qrAmountInput">Сумма (₲):</label>
      <input type="number" id="qrAmountInput" step="0.00001" placeholder="Введите сумму"
             style="width:100%; max-width:200px; margin:5px 0;" oninput="calcRubEquivalent()">
      <p id="qrRubEquivalent"></p>
      <label for="qrPurposeInput">Назначение:</label>
      <input type="text" id="qrPurposeInput" placeholder="Например, заказ #123"
             style="width:100%; max-width:200px; margin:5px 0;">
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
  const eq = document.getElementById("qrRubEquivalent");
  if (eq) eq.textContent = `≈ ${rubVal.toFixed(2)} RUB`;
}

/* Модалка с QR-кодом (мерчант) */
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

  if (typeof QRCode === "function") {
    const cont = document.getElementById("merchantQRModalContainer");
    if (cont) {
      const qrElem = document.createElement("div");
      cont.appendChild(qrElem);
      new QRCode(qrElem, {
        text: qrData,
        width: 280,
        height: 250,
        correctLevel: QRCode.CorrectLevel.L,
      });
    }
  } else {
    const c = document.getElementById("merchantQRModalContainer");
    if (c) c.innerHTML = `QR Data: ${qrData}`;
  }
  monitorPayment(qrData, amount);
}

function monitorPayment(qrData, amount) {
  const checkInterval = setInterval(async () => {
    try {
      const resp = await fetch(
        `${API_URL}/checkPaymentStatus?merchantId=${currentMerchantId}&qrData=${encodeURIComponent(
          qrData
        )}`,
        { credentials: "include" }
      );
      const data = await resp.json();
      if (data.success && data.paid) {
        clearInterval(checkInterval);
        closeModal("merchantQRModal");
        alert("✅ Оплата успешно прошла!");
        fetchMerchantBalance();
      }
    } catch (err) {
      console.error("Ошибка оплаты:", err);
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
      alert("❌ Ошибка перевода: " + (data.error || ""));
    }
  } catch (err) {
    console.error("Сбой merchantTransfer:", err);
  }
}

/* ===================================
   UPDATE UI
==================================== */
function updateUI() {
  if (currentUserId && !currentMerchantId) {
    createMainUI();
  } else if (currentMerchantId) {
    openMerchantUI();
  } else {
    openAuthModal();
  }
}

/* ===================================
   СТАРТ ПРИ ЗАГРУЗКЕ
==================================== */
document.addEventListener("DOMContentLoaded", () => {
  fetchUserData().then(() => {
    if (currentMerchantId) {
      openMerchantUI();
    } else if (currentUserId) {
      createMainUI();
    } else {
      openAuthModal();
    }
  });

  // Привязываем к кнопке "Майнить", если есть
  const mineBtn = document.getElementById("mineBtn");
  if (mineBtn) {
    mineBtn.addEventListener("click", mineCoins);
  }
});

window.addEventListener("beforeunload", () => {
  if (pendingMinedCoins > 0) {
    flushMinedCoins();
  }
});

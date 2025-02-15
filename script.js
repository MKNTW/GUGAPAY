/**************************************************
 * ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
 **************************************************/
const API_URL = "https://api.mkntw.ru";

let currentUserId = null;
let currentMerchantId = null;

let pendingMinedCoins = parseFloat(localStorage.getItem("pendingMinedCoins")) || 0;
let mineTimer = null;
let updateInterval = null;

let currentHalvingStep = 0;
let lastDirection = null;
let cycleCount = 0;
let exchangeChartInstance = null;

/**************************************************
 * УТИЛИТЫ
 **************************************************/
function formatBalance(num) {
  return parseFloat(num).toFixed(5);
}

function closeAllModals() {
  document.querySelectorAll(".modal").forEach((m) => m.classList.add("hidden"));
}

function showGlobalLoading() {
  const loader = document.getElementById("loadingIndicator");
  if (loader) loader.style.display = "flex";
}
function hideGlobalLoading() {
  const loader = document.getElementById("loadingIndicator");
  if (loader) loader.style.display = "none";
}

/**************************************************
 * СОЗДАНИЕ/ОТКРЫТИЕ/ЗАКРЫТИЕ МОДАЛЬНЫХ ОКОН
 **************************************************/
function createModal(id, innerHtml, { showCloseBtn = false } = {}) {
  // Удаляем старую модалку, если была
  const oldModal = document.getElementById(id);
  if (oldModal) oldModal.remove();

  // Создаём "контейнер" всей модалки
  const modal = document.createElement("div");
  modal.id = id;
  modal.className = "modal hidden";

  // Стили самого контейнера .modal
  // (Можно перенести в отдельный CSS — главное убедиться,
  //  что .modal-content имеет z-index выше оверлея)
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100%";
  modal.style.height = "100%";
  modal.style.background = "rgba(0,0,0,0.5)";
  modal.style.zIndex = "1500";
  // flex-контейнер, чтобы контент был сверху
  modal.style.display = "flex";
  modal.style.flexDirection = "column";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "flex-start";

  // Оверлей
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.position = "absolute";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.zIndex = "1"; // оверлей на слое 1

  // Контейнер контента
  const contentDiv = document.createElement("div");
  contentDiv.className = "modal-content";
  contentDiv.style.position = "relative";
  contentDiv.style.marginTop = "60px"; // отступ сверху, чтобы контент был "выше"
  contentDiv.style.zIndex = "2"; // контент выше оверлея
  contentDiv.style.width = "100%";
  contentDiv.style.maxWidth = "600px";
  contentDiv.style.background = "#fff";
  contentDiv.style.borderRadius = "10px";
  contentDiv.style.boxSizing = "border-box";
  contentDiv.style.overflowY = "auto";
  contentDiv.style.maxHeight = "calc(100% - 80px)"; // чуть меньше 100% высоты
  contentDiv.style.padding = "20px";

  // Если нужна круглая кнопка закрытия (showCloseBtn)
  let closeBtnHtml = "";
  if (showCloseBtn) {
    closeBtnHtml = `
      <button class="close-btn"
              style="position:absolute;top:10px;right:10px;border:none;
                     background-color:#000;color:#fff;border-radius:50%;
                     width:35px;height:35px;font-size:18px;cursor:pointer;z-index:3;">
        ×
      </button>
    `;
  }

  // Вставляем основной HTML
  contentDiv.innerHTML = closeBtnHtml + innerHtml;

  // Собираем всё
  modal.appendChild(overlay);
  modal.appendChild(contentDiv);
  document.body.appendChild(modal);

  // Закрытие по клику на оверлей
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      modal.classList.add("hidden");
    }
  });

  // Если есть close-btn, вешаем событие
  if (showCloseBtn) {
    const closeBtn = contentDiv.querySelector(".close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        modal.classList.add("hidden");
      });
    }
  }

  return modal;
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove("hidden");
}

function closeModal(id) {
  document.getElementById(id)?.classList.add("hidden");
}

/**************************************************
 * АВТОРИЗАЦИЯ / РЕГИСТРАЦИЯ / ВЫХОД
 **************************************************/
async function login() {
  const loginVal = document.getElementById("loginInput")?.value;
  const passVal = document.getElementById("passwordInput")?.value;
  if (!loginVal || !passVal) {
    alert("❌ Введите логин и пароль");
    return;
  }
  showGlobalLoading();
  try {
    const resp = await fetch(`${API_URL}/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: loginVal, password: passVal }),
    });
    const data = await resp.json();
    if (resp.ok && data.success) {
      await fetchUserData();
      document.getElementById("authModal")?.remove();
      createMainUI();
      updateUI();
      return;
    } else {
      // Пробуем мерчанта
      if (data.error?.includes("блокирован")) {
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
        await fetchMerchantData();
        document.getElementById("authModal")?.remove();
        openMerchantUI();
        return;
      } else {
        alert(`❌ Ошибка входа: ${merchData.error}`);
      }
    }
  } catch (err) {
    console.error("Ошибка при логине:", err);
  } finally {
    hideGlobalLoading();
  }
}

async function register() {
  const loginVal = document.getElementById("regLogin")?.value;
  const passVal = document.getElementById("regPassword")?.value;
  if (!loginVal || !passVal) {
    alert("❌ Введите логин и пароль");
    return;
  }
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
      // Автоматически логиним
      await login();
    } else {
      alert(`❌ Ошибка регистрации: ${data.error}`);
    }
  } catch (err) {
    console.error("Ошибка регистрации:", err);
  } finally {
    hideGlobalLoading();
  }
}

async function logout() {
  try {
    await fetch(`${API_URL}/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch (err) {
    console.error("Ошибка logout:", err);
  }
  // Сбрасываем всё
  currentUserId = null;
  currentMerchantId = null;
  document.getElementById("bottomBar")?.remove();
  closeAllModals();
  hideMainUI();
  openAuthModal();
}

/**************************************************
 * МОДАЛЬНОЕ ОКНО АВТОРИЗАЦИИ
 **************************************************/
function openAuthModal() {
  hideMainUI();
  createModal(
    "authModal",
    `
      <h2 style="text-align:center;">GugaCoin</h2>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div id="loginSection">
          <h4>Вход</h4>
          <input type="text" id="loginInput" placeholder="Логин" 
                 style="padding:8px;font-size:16px;width:100%;">
          <input type="password" id="passwordInput" placeholder="Пароль" 
                 style="padding:8px;font-size:16px;width:100%;margin-top:8px;">
          <button id="loginSubmitBtn" style="padding:10px;margin-top:8px;">Войти</button>
        </div>
        <div id="registerSection" style="display:none;">
          <h4>Регистрация</h4>
          <input type="text" id="regLogin" placeholder="Логин" 
                 style="padding:8px;font-size:16px;width:100%;">
          <input type="password" id="regPassword" placeholder="Пароль" 
                 style="padding:8px;font-size:16px;width:100%;margin-top:8px;">
          <button id="registerSubmitBtn" style="padding:10px;margin-top:8px;">Зарегистрироваться</button>
        </div>
        <button id="toggleAuthBtn" style="margin-top:10px;">Войти/Зарегистрироваться</button>
      </div>
    `
  );
  openModal("authModal");

  document.getElementById("loginSubmitBtn").addEventListener("click", login);
  document.getElementById("registerSubmitBtn").addEventListener("click", register);
  document.getElementById("toggleAuthBtn").addEventListener("click", () => {
    const loginSection = document.getElementById("loginSection");
    const registerSection = document.getElementById("registerSection");
    if (loginSection.style.display === "none") {
      loginSection.style.display = "block";
      registerSection.style.display = "none";
    } else {
      loginSection.style.display = "none";
      registerSection.style.display = "block";
    }
  });
  // Начальное состояние
  document.getElementById("loginSection").style.display = "block";
  document.getElementById("registerSection").style.display = "none";
}

/**************************************************
 * ГЛАВНЫЙ ЭКРАН
 **************************************************/
function createMainUI() {
  // Создаём нижнюю панель
  if (!document.getElementById("bottomBar")) {
    const bottomBar = document.createElement("div");
    bottomBar.id = "bottomBar";
    // Стили bottomBar (можно вынести в CSS)
    bottomBar.style.position = "fixed";
    bottomBar.style.bottom = "0";
    bottomBar.style.left = "0";
    bottomBar.style.width = "100%";
    bottomBar.style.backgroundColor = "#fff";
    bottomBar.style.display = "flex";
    bottomBar.style.justifyContent = "space-around";
    bottomBar.style.alignItems = "center";
    bottomBar.style.padding = "10px 0";
    bottomBar.style.boxShadow = "0 -2px 5px rgba(0,0,0,0.1)";
    bottomBar.style.zIndex = "3000";

    bottomBar.innerHTML = `
      <button id="btnMain" style="padding:10px;">Главная</button>
      <button id="historyBtn" style="padding:10px;">История</button>
      <button id="exchangeBtn" style="padding:10px;">Обменять</button>
    `;
    document.body.appendChild(bottomBar);

    // События
    document.getElementById("btnMain").addEventListener("click", () => {
      // При нажатии на "Главная" — закрыть все модалки, но оставить главный экран
      closeAllModals();
    });
    document.getElementById("historyBtn").addEventListener("click", () => {
      closeAllModals();
      openHistoryModal();
    });
    document.getElementById("exchangeBtn").addEventListener("click", () => {
      closeAllModals();
      openExchangeModal();
    });
  }

  // Показываем блоки баланса и кнопки для майнинга
  const balanceDisplay = document.getElementById("balanceDisplay");
  if (balanceDisplay) {
    balanceDisplay.style.display = "block"; // убираем скрытие
  }

  const mineContainer = document.getElementById("mineContainer");
  if (mineContainer) {
    mineContainer.style.display = "block";
  }

  // Добавляем две кнопки: "Перевести" и "Оплата по QR"
  if (!document.getElementById("actionButtonsContainer")) {
    const container = document.createElement("div");
    container.id = "actionButtonsContainer";
    container.style.display = "flex";
    container.style.gap = "16px";
    container.style.justifyContent = "center";
    container.style.marginTop = "100px"; // отступ сверху

    container.innerHTML = `
      <button id="transferBtn" style="padding:10px;">Перевести</button>
      <button id="payQRBtn" style="padding:10px;">Оплата по QR</button>
    `;
    document.body.appendChild(container);

    // Привязка
    document.getElementById("transferBtn").addEventListener("click", () => {
      closeAllModals();
      openTransferModal(); 
    });
    document.getElementById("payQRBtn").addEventListener("click", () => {
      closeAllModals();
      openPayQRModal();
    });
  }

  fetchUserData();
  clearInterval(updateInterval);
  updateInterval = setInterval(fetchUserData, 2000);
}

function hideMainUI() {
  document.getElementById("actionButtonsContainer")?.remove();
  const bd = document.getElementById("balanceDisplay");
  if (bd) bd.style.display = "none";
  const mc = document.getElementById("mineContainer");
  if (mc) mc.style.display = "none";
  clearInterval(updateInterval);
}

/**************************************************
 * ПОЛУЧЕНИЕ ДАННЫХ ПОЛЬЗОВАТЕЛЯ
 **************************************************/
async function fetchUserData() {
  try {
    const resp = await fetch(`${API_URL}/user`, { credentials: "include" });
    const data = await resp.json();
    if (data.success && data.user) {
      currentUserId = data.user.user_id;
      const coinBalance = data.user.balance || 0;
      const rubBalance = data.user.rub_balance || 0;

      // Отображаем в #balanceValue
      const balanceValue = document.getElementById("balanceValue");
      if (balanceValue) {
        balanceValue.textContent = coinBalance.toFixed(5) + " ₲";
      }

      // Отображаем ID (под балансом)
      const userIdEl = document.getElementById("userIdDisplay");
      if (userIdEl) {
        userIdEl.textContent = "ID: " + currentUserId;
      }

      // Если есть rubBalanceInfo
      const rubBalanceInfo = document.getElementById("rubBalanceInfo");
      if (rubBalanceInfo) {
        rubBalanceInfo.textContent = rubBalance.toFixed(2) + " ₽";
      }
    }
  } catch (err) {
    console.error("fetchUserData error:", err);
  }
}

/**************************************************
 * МАЙНИНГ
 **************************************************/
function mineCoins() {
  let localBalance = parseFloat(localStorage.getItem("localBalance")) || 0;
  localBalance += 0.00001;
  localStorage.setItem("localBalance", localBalance.toFixed(5));
  updateBalanceDisplay(localBalance);

  let pending = parseFloat(localStorage.getItem("pendingMinedCoins")) || 0;
  pending += 0.00001;
  localStorage.setItem("pendingMinedCoins", pending.toFixed(5));

  if (mineTimer) clearTimeout(mineTimer);
  mineTimer = setTimeout(() => {
    flushMinedCoins();
  }, 1500);
}

function updateBalanceDisplay(num) {
  const balanceVal = document.getElementById("balanceValue");
  if (balanceVal) {
    balanceVal.textContent = num.toFixed(5) + " ₲";
  }
}

async function flushMinedCoins() {
  const pmc = parseFloat(localStorage.getItem("pendingMinedCoins")) || 0;
  if (!currentUserId || pmc <= 0) return;
  try {
    const resp = await fetch(`${API_URL}/update`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: pmc }),
    });
    if (resp.ok) {
      localStorage.setItem("pendingMinedCoins", "0");
      fetchUserData();
    }
  } catch (err) {
    console.error("flushMinedCoins error:", err);
  }
}

/**************************************************
 * МОДАЛКА "ПЕРЕВОД" (С КНОПКОЙ ЗАКРЫТИЯ)
 **************************************************/
function openTransferModal() {
  createModal(
    "transferModal",
    `
      <h3>Перевод</h3>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">
        <label>Кому (ID):</label>
        <input type="text" id="toUserIdInput" placeholder="ID получателя" style="padding:8px;font-size:16px;">
        <label>Сумма (₲):</label>
        <input type="number" id="transferAmountInput" step="0.00001" placeholder="Введите сумму" style="padding:8px;font-size:16px;">
        <button id="sendTransferBtn" style="padding:10px;">Отправить</button>
      </div>
    `,
    { showCloseBtn: true }
  );
  openModal("transferModal");

  const sendBtn = document.getElementById("sendTransferBtn");
  sendBtn.onclick = async () => {
    if (!currentUserId) return;
    const toUser = document.getElementById("toUserIdInput")?.value;
    const amount = parseFloat(document.getElementById("transferAmountInput")?.value);
    if (!toUser || !amount || amount <= 0) {
      alert("❌ Введите корректные данные");
      return;
    }
    if (toUser === currentUserId) {
      alert("❌ Нельзя перевести самому себе");
      return;
    }
    try {
      const resp = await fetch(`${API_URL}/transfer`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUserId: currentUserId, toUserId: toUser, amount }),
      });
      const data = await resp.json();
      if (data.success) {
        alert("✅ Перевод выполнен!");
        closeModal("transferModal");
        fetchUserData();
      } else {
        alert("❌ Ошибка перевода: " + data.error);
      }
    } catch (err) {
      console.error("Ошибка при переводе:", err);
    }
  };
}

/**************************************************
 * МОДАЛКА "ОПЛАТА ПО QR" (С КНОПКОЙ ЗАКРЫТИЯ)
 **************************************************/
function openPayQRModal() {
  createModal(
    "payQRModal",
    `
      <h3>Оплата по QR</h3>
      <video id="opPayVideo" style="width:100%;max-width:600px; border:2px solid #333; margin-top:10px;" muted playsinline></video>
    `,
    { showCloseBtn: true }
  );
  openModal("payQRModal");

  const videoEl = document.getElementById("opPayVideo");
  startUniversalQRScanner(videoEl, (rawValue) => {
    closeModal("payQRModal");
    const parsed = parseMerchantQRData(rawValue);
    if (!parsed.merchantId) {
      alert("❌ Неверный QR. Нет merchantId.");
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
      <p>Мерчант: ${merchantId}</p>
      <p>Сумма: ${amount} ₲</p>
      <p>Назначение: ${purpose}</p>
      <button id="confirmPayBtn" style="padding:10px;margin-top:10px;">Оплатить</button>
    `,
    { showCloseBtn: true }
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
        alert("✅ Оплачено!");
        closeModal("confirmPayMerchantModal");
        fetchUserData();
      } else {
        alert("❌ Ошибка: " + data.error);
      }
    } catch (err) {
      console.error("payMerchantOneTime error:", err);
    }
  };
}

/**************************************************
 * СКАНИРОВАНИЕ QR
 **************************************************/
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
            console.error("BarcodeDetector:", err);
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
      console.error("Ошибка камеры:", err);
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
  return {
    merchantId: merchantIdMatch ? merchantIdMatch[1] : "",
    amount: amountMatch ? parseFloat(amountMatch[1]) : 0,
    purpose: purposeMatch ? decodeURIComponent(purposeMatch[1]) : "",
  };
}

/**************************************************
 * ОБМЕН ВАЛЮТЫ (история, график и т.д.)
 **************************************************/
let currentExchangeDirection = "coin_to_rub";
let currentExchangeRate = 0;

async function openExchangeModal() {
  showGlobalLoading();
  createModal(
    "exchangeModal",
    `
      <h3 style="text-align:center;">Обмен</h3>
      <div style="max-width:600px;margin:0 auto;">
        <canvas id="exchangeChart" style="width:100%;max-height:200px;"></canvas>
      </div>
      <p id="currentRateDisplay" style="text-align:center;margin:10px 0;">Курс: --</p>
      <div style="display:flex;justify-content:center;gap:10px;align-items:center;margin-top:20px;">
        <div style="flex:1;text-align:center;">
          <p id="fromLabel">GUGA</p>
          <input type="number" id="amountInput" placeholder="0.00" style="width:100%;padding:8px;" oninput="updateExchange()">
          <p id="balanceInfo" style="font-size:14px;color:#666;">0.00000 ₲</p>
        </div>
        <button id="swapBtn" style="padding:10px;">⇄</button>
        <div style="flex:1;text-align:center;">
          <p id="toLabel">RUB</p>
          <input type="text" id="toAmount" disabled style="width:100%;padding:8px;">
          <p id="toBalanceInfo" style="font-size:14px;color:#666;">0.00 ₽</p>
        </div>
      </div>
      <button id="btnPerformExchange" style="margin-top:20px;padding:10px;">Обменять</button>
    `
  );
  openModal("exchangeModal");

  currentExchangeDirection = "coin_to_rub";
  updateCurrencyLabels();
  try {
    await loadBalanceAndExchangeRate();
    updateCurrentRateDisplay();
    drawExchangeChart();
    document.getElementById("btnPerformExchange").onclick = () => {
      handleExchange(currentExchangeDirection);
    };
    document.getElementById("swapBtn").onclick = swapCurrencies;
  } catch (err) {
    console.error("openExchangeModal error:", err);
  } finally {
    hideGlobalLoading();
  }
}

function updateExchange() {
  const amount = parseFloat(document.getElementById("amountInput").value);
  if (isNaN(amount) || !currentExchangeRate) {
    document.getElementById("toAmount").value = "";
    return;
  }
  if (currentExchangeDirection === "coin_to_rub") {
    const result = amount * currentExchangeRate;
    document.getElementById("toAmount").value = result.toFixed(2);
  } else {
    const result = amount / currentExchangeRate;
    document.getElementById("toAmount").value = result.toFixed(5);
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
    fromLabel.textContent = "GUGA";
    toLabel.textContent = "RUB";
  } else {
    fromLabel.textContent = "RUB";
    toLabel.textContent = "GUGA";
  }
}

async function handleExchange(direction) {
  const amount = parseFloat(document.getElementById("amountInput").value);
  if (isNaN(amount) || amount <= 0) {
    alert("Введите корректную сумму");
    return;
  }
  // Предотвращаем повторную ту же операцию
  if (lastDirection === direction) {
    alert("Нельзя подряд делать одинаковые операции");
    return;
  }
  showGlobalLoading();
  try {
    const resp = await fetch(`${API_URL}/exchange`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction, amount }),
    });
    const data = await resp.json();
    if (data.success) {
      let msg = "";
      if (direction === "rub_to_coin") {
        msg = `${amount} ₽ → ${parseFloat(data.exchanged_amount).toFixed(5)} ₲`;
      } else {
        msg = `${amount} ₲ → ${parseFloat(data.exchanged_amount).toFixed(2)} ₽`;
      }
      alert("✅ Обмен выполнен! " + msg);
      lastDirection = direction;
      setTimeout(() => (lastDirection = null), 5000);
      await loadBalanceAndExchangeRate();
    } else {
      alert("❌ Ошибка обмена: " + data.error);
    }
  } catch (err) {
    console.error("handleExchange error:", err);
    alert("Произошла ошибка при обмене");
  } finally {
    hideGlobalLoading();
  }
}

async function loadBalanceAndExchangeRate() {
  try {
    const userResp = await fetch(`${API_URL}/user`, { credentials: "include" });
    const userData = await userResp.json();
    if (userData.success && userData.user) {
      if (currentExchangeDirection === "coin_to_rub") {
        document.getElementById("balanceInfo").textContent =
          (userData.user.balance || 0).toFixed(5) + " ₲";
        document.getElementById("toBalanceInfo").textContent =
          (userData.user.rub_balance || 0).toFixed(2) + " ₽";
      } else {
        document.getElementById("balanceInfo").textContent =
          (userData.user.rub_balance || 0).toFixed(2) + " ₽";
        document.getElementById("toBalanceInfo").textContent =
          (userData.user.balance || 0).toFixed(5) + " ₲";
      }
    }
  } catch (err) {
    console.error("loadBalanceAndExchangeRate user error:", err);
  }

  // Загрузим историю
  try {
    const rateResp = await fetch(`${API_URL}/exchangeRates?limit=200`, {
      credentials: "include",
    });
    const rateData = await rateResp.json();
    if (rateData.success && rateData.rates?.length) {
      currentExchangeRate = parseFloat(rateData.rates[0].exchange_rate);
      drawExchangeChart(rateData.rates);
      updateCurrentRateDisplay();
    }
  } catch (err) {
    console.error("loadBalanceAndExchangeRate rates error:", err);
  }
}

function updateCurrentRateDisplay() {
  if (!currentExchangeRate) {
    document.getElementById("currentRateDisplay").textContent = "Курс: --";
    return;
  }
  document.getElementById("currentRateDisplay").textContent =
    "Курс: 1 ₲ = " + currentExchangeRate.toFixed(2) + " ₽";
}

function drawExchangeChart(rates) {
  if (!rates || !rates.length) return;
  if (exchangeChartInstance) exchangeChartInstance.destroy();

  const sorted = [...rates].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );
  const labels = sorted.map((r) => {
    const dd = new Date(r.created_at);
    return (
      dd.getHours().toString().padStart(2, "0") +
      ":" +
      dd.getMinutes().toString().padStart(2, "0")
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

/**************************************************
 * МОДАЛКА "ИСТОРИЯ"
 **************************************************/
function openHistoryModal() {
  createModal(
    "historyModal",
    `
      <h2 style="text-align:center;">История операций</h2>
      <div style="max-height:calc(100% - 100px);overflow-y:auto;">
        <ul id="transactionList" style="padding:0;list-style:none;margin:0;"></ul>
      </div>
    `
  );
  openModal("historyModal");
  fetchTransactionHistory();
}

async function fetchTransactionHistory() {
  if (!currentUserId) return;
  showGlobalLoading();
  try {
    const resp = await fetch(`${API_URL}/transactions?userId=${currentUserId}`, {
      credentials: "include",
    });
    const data = await resp.json();
    if (data.success && data.transactions) {
      displayTransactionHistory(data.transactions);
    } else {
      alert("Ошибка истории: " + data.error);
    }
  } catch (err) {
    console.error("fetchTransactionHistory error:", err);
  } finally {
    hideGlobalLoading();
  }
}

function displayTransactionHistory(transactions) {
  const list = document.getElementById("transactionList");
  if (!list) return;
  list.innerHTML = "";
  if (!transactions.length) {
    list.innerHTML = "<li>Нет операций</li>";
    return;
  }
  // Группируем
  const groups = {};
  transactions.forEach((tx) => {
    const d = new Date(tx.client_time || tx.created_at);
    const label = getDateLabel(d);
    if (!groups[label]) groups[label] = [];
    groups[label].push(tx);
  });
  // сортируем заголовки
  const sortedDates = Object.keys(groups).sort((a, b) => {
    const dA = new Date(groups[a][0].client_time || groups[a][0].created_at);
    const dB = new Date(groups[b][0].client_time || groups[b][0].created_at);
    return dB - dA;
  });
  // Выводим
  sortedDates.forEach((dateStr) => {
    const dateItem = document.createElement("li");
    dateItem.style.border = "1px solid #ccc";
    dateItem.style.margin = "10px";
    dateItem.style.padding = "10px";
    dateItem.innerHTML = `<strong>${dateStr}</strong>`;
    groups[dateStr].forEach((tx) => {
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
        const merch =
          tx.merchant_id ||
          (tx.to_user_id && tx.to_user_id.replace("MERCHANT:", "")) ||
          "???";
        opHTML = `
          <div>Оплата по QR 💳</div>
          <div>Мерчант: ${merch}</div>
          <div>Сумма: ${tx.amount} ₲</div>
          <div>Время: ${timeStr}</div>
        `;
      } else if (tx.from_user_id === currentUserId) {
        opHTML = `
          <div>Исходящая операция ⤴</div>
          <div>Кому: ${tx.to_user_id}</div>
          <div>Сумма: ${formatBalance(tx.amount)} ₲</div>
          <div>Время: ${timeStr}</div>
        `;
      } else if (tx.to_user_id === currentUserId) {
        opHTML = `
          <div>Входящая операция ⤵</div>
          <div>От кого: ${tx.from_user_id}</div>
          <div>Сумма: ${formatBalance(tx.amount)} ₲</div>
          <div>Время: ${timeStr}</div>
        `;
      } else {
        opHTML = `
          <div>Операция</div>
          <div>Сумма: ${formatBalance(tx.amount || 0)} ₲</div>
          <div>Время: ${timeStr}</div>
        `;
      }
      const txDiv = document.createElement("div");
      txDiv.style.borderBottom = "1px dashed #ccc";
      txDiv.style.padding = "5px 0";
      txDiv.innerHTML = opHTML;
      dateItem.appendChild(txDiv);
    });
    list.appendChild(dateItem);
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

/**************************************************
 * МЕРЧАНТСКИЙ ИНТЕРФЕЙС
 **************************************************/
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

  const div = document.createElement("div");
  div.id = "merchantInterface";
  div.style.display = "flex";
  div.style.flexDirection = "column";
  div.style.alignItems = "center";
  div.style.marginTop = "80px";
  div.innerHTML = `
    <h2>Кабинет мерчанта</h2>
    <p>Мерчант: <strong>${currentMerchantId}</strong></p>
    <p>Баланс: <span id="merchantBalanceValue">0.00000</span> ₲</p>
    <div style="display:flex;gap:10px;margin-top:20px;">
      <button id="merchantCreateQRBtn">Создать QR</button>
      <button id="merchantTransferBtn">Перевести</button>
      <button id="merchantLogoutBtn">Выйти</button>
    </div>
  `;
  document.body.appendChild(div);

  document.getElementById("merchantCreateQRBtn").onclick = openOneTimeQRModal;
  document.getElementById("merchantTransferBtn").onclick = openMerchantTransferModal;
  document.getElementById("merchantLogoutBtn").onclick = logout;

  fetchMerchantData();
}

async function fetchMerchantData() {
  await fetchMerchantBalance();
  try {
    const resp = await fetch(`${API_URL}/halvingInfo`, { credentials: "include" });
    const data = await resp.json();
    if (data.success) {
      currentHalvingStep = data.halvingStep || 0;
    }
  } catch (err) {
    console.error("fetchMerchantData halvingInfo:", err);
  }
}

async function fetchMerchantInfo() {
  try {
    const resp = await fetch(`${API_URL}/merchant/info`, { credentials: "include" });
    const data = await resp.json();
    if (resp.ok && data.success && data.merchant) {
      currentMerchantId = data.merchant.merchant_id;
    }
  } catch (err) {
    console.error("fetchMerchantInfo:", err);
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
    if (data.success) {
      document.getElementById("merchantBalanceValue").textContent = parseFloat(data.balance).toFixed(5);
    }
  } catch (err) {
    console.error("fetchMerchantBalance:", err);
  }
}

/* Модалка "Создать QR" (мерчант) */
function openOneTimeQRModal() {
  createModal(
    "createOneTimeQRModal",
    `
      <h3>Создать запрос на оплату</h3>
      <label>Сумма (₲):</label>
      <input type="number" id="qrAmountInput" step="0.00001" style="padding:8px;font-size:16px;" oninput="calcRubEquivalent()">
      <p id="qrRubEquivalent"></p>
      <label>Назначение:</label>
      <input type="text" id="qrPurposeInput" style="padding:8px;font-size:16px;">
      <button id="createQRBtn" style="padding:10px;margin-top:10px;">Создать</button>
    `
  );
  openModal("createOneTimeQRModal");

  document.getElementById("createQRBtn").onclick = () => {
    const amount = parseFloat(document.getElementById("qrAmountInput").value);
    const purpose = document.getElementById("qrPurposeInput").value || "";
    if (!amount || amount <= 0) {
      alert("Некорректная сумма");
      return;
    }
    closeModal("createOneTimeQRModal");
    createMerchantQR(amount, purpose);
  };
}

function calcRubEquivalent() {
  const coinVal = parseFloat(document.getElementById("qrAmountInput").value) || 0;
  const rubMultiplier = 1 + currentHalvingStep * 0.02;
  const rubVal = coinVal * rubMultiplier;
  document.getElementById("qrRubEquivalent").textContent = "≈ " + rubVal.toFixed(2) + " RUB";
}

/* Создаём QR (мерчант) */
function createMerchantQR(amount, purpose) {
  const qrData = `guga://merchantId=${currentMerchantId}&amount=${amount}&purpose=${encodeURIComponent(purpose)}`;
  createModal(
    "merchantQRModal",
    `
      <div id="merchantQRModalContainer"></div>
      <p style="margin-top:10px;">Запрашиваемая сумма: ${amount} ₲</p>
    `
  );
  openModal("merchantQRModal");

  if (typeof QRCode === "function") {
    const container = document.getElementById("merchantQRModalContainer");
    if (container) {
      const qrElem = document.createElement("div");
      container.appendChild(qrElem);
      new QRCode(qrElem, {
        text: qrData,
        width: 220,
        height: 220,
      });
    }
  } else {
    document.getElementById("merchantQRModalContainer").textContent = "QR data: " + qrData;
  }
  monitorPayment(qrData);
}

function monitorPayment(qrData) {
  const timer = setInterval(async () => {
    try {
      const resp = await fetch(
        `${API_URL}/checkPaymentStatus?merchantId=${currentMerchantId}&qrData=${encodeURIComponent(qrData)}`,
        { credentials: "include" }
      );
      const data = await resp.json();
      if (data.success && data.paid) {
        clearInterval(timer);
        closeModal("merchantQRModal");
        alert("✅ Оплата прошла успешно!");
        fetchMerchantBalance();
      }
    } catch (err) {
      console.error("monitorPayment:", err);
    }
  }, 3000);
}

/* Модалка "Перевести" (мерчант -> пользователь) */
function openMerchantTransferModal() {
  createModal(
    "merchantTransferModal",
    `
      <h3>Перевести на пользователя</h3>
      <label>ID пользователя:</label>
      <input type="text" id="merchantToUserIdInput" style="padding:8px;font-size:16px;">
      <label>Сумма (₲):</label>
      <input type="number" id="merchantTransferAmountInput" step="0.00001" style="padding:8px;font-size:16px;">
      <button id="merchantTransferSendBtn" style="padding:10px;margin-top:10px;">Отправить</button>
    `
  );
  openModal("merchantTransferModal");

  document.getElementById("merchantTransferSendBtn").onclick = async () => {
    const toUserId = document.getElementById("merchantToUserIdInput").value;
    const amount = parseFloat(document.getElementById("merchantTransferAmountInput").value);
    if (!toUserId || !amount || amount <= 0) {
      alert("Некорректные данные");
      return;
    }
    try {
      const resp = await fetch(`${API_URL}/merchantTransfer`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId: currentMerchantId, toUserId, amount }),
      });
      const data = await resp.json();
      if (data.success) {
        alert("Перевод выполнен!");
        closeModal("merchantTransferModal");
        fetchMerchantBalance();
      } else {
        alert("Ошибка: " + data.error);
      }
    } catch (err) {
      console.error("merchantTransfer:", err);
    }
  };
}

/**************************************************
 * UPDATE UI
 **************************************************/
function updateUI() {
  if (currentUserId && !currentMerchantId) {
    createMainUI();
  } else if (currentMerchantId) {
    openMerchantUI();
  } else {
    openAuthModal();
  }
}

/**************************************************
 * DOMContentLoaded
 **************************************************/
document.addEventListener("DOMContentLoaded", () => {
  // При загрузке проверяем, есть ли userId или merchantId
  fetchUserData().then(() => {
    if (currentMerchantId) {
      openMerchantUI();
    } else if (currentUserId) {
      createMainUI();
    } else {
      openAuthModal();
    }
  });

  // Кнопка "Майнить", если есть
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

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
 * CSS АНИМАЦИИ (slideUp / slideDown / swap-rotate)
 **************************************************/
const globalStyle = document.createElement("style");
globalStyle.textContent = `
  /* Открытие (снизу вверх) за 0.3s */
  @keyframes slideUp {
    0% {
      transform: translateY(100%);
    }
    100% {
      transform: translateY(0);
    }
  }
  .modal-slide-up {
    animation: slideUp 0.3s ease forwards;
  }

  /* Закрытие (сверху вниз) за 0.3s */
  @keyframes slideDown {
    0% {
      transform: translateY(0);
    }
    100% {
      transform: translateY(100%);
    }
  }
  .modal-slide-down {
    animation: slideDown 0.3s ease forwards;
  }

  /* Вращение swapBtn */
  .swap-rotate {
    transition: transform 0.3s ease;
    transform: rotate(360deg);
  }
`;
document.head.appendChild(globalStyle);

/**************************************************
 * УТИЛИТЫ
 **************************************************/
function formatBalance(num) {
  return parseFloat(num).toFixed(5);
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
 * ФУНКЦИЯ ЗАКРЫТИЯ МОДАЛОК "СВЕРХУ ВНИЗ"
 **************************************************/
function closeModalWithAnimation(modalId) {
  const modalEl = document.getElementById(modalId);
  if (!modalEl) return;
  const content = modalEl.querySelector(".modal-content");
  if (!content) {
    modalEl.remove();
    return;
  }
  // Убираем slide-up, добавляем slide-down
  content.classList.remove("modal-slide-up");
  content.classList.add("modal-slide-down");
  // По окончании анимации — remove
  content.addEventListener(
    "animationend",
    () => {
      modalEl.remove();
    },
    { once: true }
  );
}

/** Закрыть "История" или "Обмен" при нажатии на "Главная" **/
function closeHistoryOrExchange() {
  if (document.getElementById("historyModal")) {
    closeModalWithAnimation("historyModal");
  }
  if (document.getElementById("exchangeModal")) {
    closeModalWithAnimation("exchangeModal");
  }
}

/**************************************************
 * СОЗДАНИЕ / ОТКРЫТИЕ МОДАЛЬНЫХ ОКОН
 **************************************************/
/**
 * createModal(id, innerHtml, {
 *   showCloseBtn,         // bool
 *   cornerTopMargin,      // px
 *   cornerTopRadius,      // px (только верхние углы)
 *   hasVerticalScroll,    // bool (overflow-y: auto|hidden)
 *   closeBtnCenter        // bool (крестик по центру)
 * }).
 */
function createModal(
  id,
  innerHtml,
  {
    showCloseBtn = false,
    cornerTopMargin = 0,
    cornerTopRadius = 0,
    hasVerticalScroll = true,
    closeBtnCenter = false,
  } = {}
) {
  // Удаляем старое, если есть
  const old = document.getElementById(id);
  if (old) old.remove();

  const modal = document.createElement("div");
  modal.id = id;
  modal.className = "modal";
  // zIndex ниже bottomBar
  modal.style.zIndex = "99999";
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100%";
  modal.style.height = "100%";
  modal.style.background = "rgba(0,0,0,0.5)";
  modal.style.display = "flex";
  modal.style.flexDirection = "column";
  modal.style.justifyContent = "flex-start";
  modal.style.alignItems = "stretch";

  const overlay = document.createElement("div");
  overlay.style.position = "absolute";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";

  const contentDiv = document.createElement("div");
  contentDiv.className = "modal-content modal-slide-up"; // открытие slideUp
  contentDiv.style.marginTop = `${cornerTopMargin}px`;
  contentDiv.style.width = "100%";
  contentDiv.style.height = `calc(100% - ${cornerTopMargin}px)`;
  contentDiv.style.background = "#fff";
  contentDiv.style.boxSizing = "border-box";
  contentDiv.style.overflowY = hasVerticalScroll ? "auto" : "hidden";
  contentDiv.style.position = "relative";
  contentDiv.style.padding = "20px";

  // Скруглим только верхние углы?
  if (cornerTopRadius > 0) {
    contentDiv.style.borderRadius = `${cornerTopRadius}px ${cornerTopRadius}px 0 0`;
  } else {
    contentDiv.style.borderRadius = "0";
  }

  let closeBtnHtml = "";
  if (showCloseBtn) {
    if (closeBtnCenter) {
      // Крестик по центру
      closeBtnHtml = `
        <button class="close-btn" style="
          position:absolute;
          top:10px;
          left:50%;
          transform:translateX(-50%);
          border:none;
          background:#000;
          color:#fff;
          width:30px;
          height:30px;
          font-size:18px;
          cursor:pointer;">
          ×
        </button>
      `;
    } else {
      // Крестик справа
      closeBtnHtml = `
        <button class="close-btn" style="
          position:absolute;
          top:10px;
          right:10px;
          border:none;
          background:#000;
          color:#fff;
          width:30px;
          height:30px;
          font-size:18px;
          cursor:pointer;">
          ×
        </button>
      `;
    }
  }

  contentDiv.innerHTML = closeBtnHtml + innerHtml;
  modal.appendChild(overlay);
  modal.appendChild(contentDiv);
  document.body.appendChild(modal);

  // Закрытие по overlay
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      modal.remove();
    }
  });

  // Закрытие по крестику
  if (showCloseBtn) {
    const cbtn = contentDiv.querySelector(".close-btn");
    if (cbtn) {
      cbtn.addEventListener("click", () => {
        modal.remove();
      });
    }
  }

  return modal;
}

/**************************************************
 * АВТОРИЗАЦИЯ / РЕГИСТРАЦИЯ / ЛОГИКА
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
      if (data.error?.includes("блокирован")) {
        alert("❌ Ваш аккаунт заблокирован");
        return;
      }
      // Попробуем мерчант-вход:
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
  currentUserId = null;
  currentMerchantId = null;
  document.getElementById("bottomBar")?.remove();
  removeAllModals();
  hideMainUI();
  openAuthModal();
}

/**************************************************
 * ОКНО АВТОРИЗАЦИИ (AUTHMODAL)
 **************************************************/
function openAuthModal() {
  hideMainUI();
  removeAllModals();

  createModal(
    "authModal",
    `
      <h2 style="text-align:center;">GugaCoin</h2>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div id="loginSection">
          <h4>Вход</h4>
          <input type="text" id="loginInput" placeholder="Логин" style="padding:8px;font-size:16px;width:100%;">
          <input type="password" id="passwordInput" placeholder="Пароль" style="padding:8px;font-size:16px;width:100%;margin-top:8px;">
          <button id="loginSubmitBtn" style="padding:10px;margin-top:8px;">Войти</button>
        </div>
        <div id="registerSection" style="display:none;">
          <h4>Регистрация</h4>
          <input type="text" id="regLogin" placeholder="Логин" style="padding:8px;font-size:16px;width:100%;">
          <input type="password" id="regPassword" placeholder="Пароль" style="padding:8px;font-size:16px;width:100%;margin-top:8px;">
          <button id="registerSubmitBtn" style="padding:10px;margin-top:8px;">Зарегистрироваться</button>
        </div>
        <button id="toggleAuthBtn" style="margin-top:10px;">Войти/Зарегистрироваться</button>
      </div>
    `,
    {
      showCloseBtn: false,
      cornerTopMargin: 0,
      cornerTopRadius: 0,
      hasVerticalScroll: true,
      closeBtnCenter: false,
    }
  );

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
  document.getElementById("loginSection").style.display = "block";
  document.getElementById("registerSection").style.display = "none";
}

/**************************************************
 * ГЛАВНЫЙ ЭКРАН: createMainUI()
 **************************************************/
function createMainUI() {
  // Если merchantId не задан, значит пользователь.
  if (!currentMerchantId && !document.getElementById("profileIcon")) {
    const profileIcon = document.createElement("img");
    profileIcon.id = "profileIcon";
    profileIcon.src = "68.png";
    profileIcon.style.width = "35px";
    profileIcon.style.height = "35px";
    profileIcon.style.position = "fixed";
    profileIcon.style.top = "10px";
    profileIcon.style.right = "10px";
    profileIcon.style.cursor = "pointer";
    profileIcon.style.zIndex = "90000";
    document.body.appendChild(profileIcon);

    profileIcon.addEventListener("click", openProfileModal);
  }

  // bottomBar
  if (!document.getElementById("bottomBar")) {
    const bottomBar = document.createElement("div");
    bottomBar.id = "bottomBar";
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
    bottomBar.style.zIndex = "999999"; // всегда выше модалок

    bottomBar.innerHTML = `
      <button id="btnMain" style="padding:10px;border:none;background:none;">
        <img src="69.png" style="width:30px;height:30px;display:block;margin:0 auto;">
        Главная
      </button>
      <button id="historyBtn" style="padding:10px;border:none;background:none;">
        <img src="70.png" style="width:30px;height:30px;display:block;margin:0 auto;">
        История
      </button>
      <button id="exchangeBtn" style="padding:10px;border:none;background:none;">
        <img src="71.png" style="width:30px;height:30px;display:block;margin:0 auto;">
        Обменять
      </button>
    `;
    document.body.appendChild(bottomBar);

    // при нажатии на "Главная" — закрываем history/exchange (slideDown)
    document.getElementById("btnMain").addEventListener("click", () => {
      closeHistoryOrExchange();
    });
    document.getElementById("historyBtn").addEventListener("click", () => {
      removeAllModals();
      openHistoryModal();
    });
    document.getElementById("exchangeBtn").addEventListener("click", () => {
      removeAllModals();
      openExchangeModal();
    });
  }

  // Показываем блоки баланса / майнинга
  const balanceDisplay = document.getElementById("balanceDisplay");
  if (balanceDisplay) {
    balanceDisplay.style.display = "block";
  }
  const mineContainer = document.getElementById("mineContainer");
  if (mineContainer) {
    mineContainer.style.display = "block";
    mineContainer.style.width = "220px";
    mineContainer.style.height = "220px";
    const mineBtn = document.getElementById("mineBtn");
    if (mineBtn) {
      mineBtn.style.width = "100%";
      mineBtn.style.height = "100%";
    }
  }

  // ActionButtons
  if (!document.getElementById("actionButtonsContainer")) {
    const container = document.createElement("div");
    container.id = "actionButtonsContainer";
    container.style.position = "fixed";
    container.style.top = "180px";
    container.style.left = "50%";
    container.style.transform = "translateX(-50%)";
    container.style.display = "flex";
    container.style.flexDirection = "row";
    container.style.gap = "16px";
    container.style.zIndex = "90000";

    // "Перевести" / "Оплата по QR"
    container.innerHTML = `
      <button id="transferBtn" style="padding:10px;border:none;background:none;font-size:14px;display:flex;flex-direction:column;align-items:center;gap:4px;">
        <img src="81.png" style="width:25px;height:25px;">
        Перевести
      </button>
      <button id="payQRBtn" style="padding:10px;border:none;background:none;font-size:14px;display:flex;flex-direction:column;align-items:center;gap:4px;">
        <img src="90.png" style="width:25px;height:25px;">
        Оплата по QR
      </button>
    `;
    document.body.appendChild(container);

    document.getElementById("transferBtn").addEventListener("click", () => {
      removeAllModals();
      openTransferModal();
    });
    document.getElementById("payQRBtn").addEventListener("click", () => {
      removeAllModals();
      openPayQRModal();
    });
  }

  fetchUserData();
  clearInterval(updateInterval);
  updateInterval = setInterval(fetchUserData, 2000);
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

      const balanceValue = document.getElementById("balanceValue");
      if (balanceValue) {
        balanceValue.textContent = coinBalance.toFixed(5) + " ₲";
      }
      const userIdEl = document.getElementById("userIdDisplay");
      if (userIdEl) {
        userIdEl.textContent = "ID: " + currentUserId;
      }
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
 * ОКНО "ПРОФИЛЬ" (большие скругления, крестик по центру)
 **************************************************/
function openProfileModal() {
  createModal(
    "profileModal",
    `
      <h3 style="text-align:center;">Профиль</h3>
      <button id="profileLogoutBtn" style="padding:10px;margin-top:20px;">Выйти из аккаунта</button>
    `,
    {
      showCloseBtn: true,
      cornerTopMargin: 50,
      cornerTopRadius: 20,
      hasVerticalScroll: true,
      closeBtnCenter: true,
    }
  );
  document.getElementById("profileLogoutBtn").onclick = logout;
}

/**************************************************
 * ОКНО "ПЕРЕВОД"
 **************************************************/
function openTransferModal() {
  createModal(
    "transferModal",
    `
      <h3 style="text-align:center;">Перевод</h3>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">
        <label>Кому (ID):</label>
        <input type="text" id="toUserIdInput" placeholder="ID получателя" style="padding:8px;font-size:16px;">
        <label>Сумма (₲):</label>
        <input type="number" id="transferAmountInput" step="0.00001" placeholder="Введите сумму" style="padding:8px;font-size:16px;">
        <button id="sendTransferBtn" style="padding:10px;">Отправить</button>
      </div>
    `,
    {
      showCloseBtn: true,
      cornerTopMargin: 50,
      cornerTopRadius: 20,
      hasVerticalScroll: true,
      closeBtnCenter: true,
    }
  );

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
        document.getElementById("transferModal")?.remove();
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
 * ОКНО "ОПЛАТА ПО QR"
 **************************************************/
function openPayQRModal() {
  createModal(
    "payQRModal",
    `
      <h3 style="text-align:center;">Оплата по QR</h3>
      <video id="opPayVideo" style="width:100%;max-width:600px; border:2px solid #333; margin-top:10px;" muted playsinline></video>
    `,
    {
      showCloseBtn: true,
      cornerTopMargin: 50,
      cornerTopRadius: 20,
      hasVerticalScroll: true,
      closeBtnCenter: true,
    }
  );

  const videoEl = document.getElementById("opPayVideo");
  startUniversalQRScanner(videoEl, (rawValue) => {
    document.getElementById("payQRModal")?.remove();
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
      <h3 style="text-align:center;">Подтверждение оплаты</h3>
      <p>Мерчант: ${merchantId}</p>
      <p>Сумма: ${amount} ₲</p>
      <p>Назначение: ${purpose}</p>
      <button id="confirmPayBtn" style="padding:10px;margin-top:10px;">Оплатить</button>
    `,
    {
      showCloseBtn: true,
      cornerTopMargin: 50,
      cornerTopRadius: 20,
      hasVerticalScroll: true,
      closeBtnCenter: true,
    }
  );

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
        document.getElementById("confirmPayMerchantModal")?.remove();
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
 * ОБМЕН
 **************************************************/
let currentExchangeDirection = "coin_to_rub";
let currentExchangeRate = 0;

async function openExchangeModal() {
  showGlobalLoading();
  removeAllModals();

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
          <p id="fromLabel">
            <img src="15.png" alt="GUGA" style="width:25px;vertical-align:middle;"> GUGA
          </p>
          <input type="number" id="amountInput" placeholder="0.00" style="width:100%;padding:8px;" oninput="updateExchange()">
          <p id="balanceInfo" style="font-size:14px;color:#666;">0.00000 ₲</p>
        </div>
        <button id="swapBtn" style="padding:10px;border:none;background:none;cursor:pointer;font-size:24px;">⇄</button>
        <div style="flex:1;text-align:center;">
          <p id="toLabel">
            <img src="18.png" alt="RUB" style="width:25px;vertical-align:middle;"> RUB
          </p>
          <input type="text" id="toAmount" disabled style="width:100%;padding:8px;">
          <p id="toBalanceInfo" style="font-size:14px;color:#666;">0.00 ₽</p>
        </div>
      </div>
      <div style="text-align:center;margin-top:20px;">
        <button id="btnPerformExchange" style="padding:10px;">Обменять</button>
      </div>
    `,
    {
      showCloseBtn: false, // без кнопки X
      cornerTopMargin: 0, // без отступа
      cornerTopRadius: 0, // без скруглённых углов
      hasVerticalScroll: true,
      closeBtnCenter: false,
    }
  );

  const swapBtn = document.getElementById("swapBtn");
  swapBtn.addEventListener("click", () => {
    swapBtn.classList.add("swap-rotate");
    setTimeout(() => swapBtn.classList.remove("swap-rotate"), 300);
    swapCurrencies();
  });

  try {
    await loadBalanceAndExchangeRate();
    updateCurrentRateDisplay();
    drawExchangeChart();
    document.getElementById("btnPerformExchange").onclick = () => {
      handleExchange(currentExchangeDirection);
    };
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
    fromLabel.innerHTML = `<img src="15.png" alt="GUGA" style="width:25px;vertical-align:middle;"> GUGA`;
    toLabel.innerHTML = `<img src="18.png" alt="RUB" style="width:25px;vertical-align:middle;"> RUB`;
  } else {
    fromLabel.innerHTML = `<img src="18.png" alt="RUB" style="width:25px;vertical-align:middle;"> RUB`;
    toLabel.innerHTML = `<img src="15.png" alt="GUGA" style="width:25px;vertical-align:middle;"> GUGA`;
  }
}

async function handleExchange(direction) {
  const amount = parseFloat(document.getElementById("amountInput").value);
  if (isNaN(amount) || amount <= 0) {
    alert("Введите корректную сумму");
    return;
  }
  if (lastDirection === direction) {
    alert("❌ Нельзя подряд делать одинаковые операции");
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
        x: {
          display: true,
          grid: { display: false, drawBorder: false },
        },
        y: {
          display: true,
          grid: { display: false, drawBorder: false },
        },
      },
      plugins: { legend: { display: false } },
    },
  });
}

/**************************************************
 * ОКНО "ИСТОРИЯ" (нет вертикальной прокрутки)
 **************************************************/
function openHistoryModal() {
  removeAllModals();
  createModal(
    "historyModal",
    `
      <h2 style="text-align:center;">История операций</h2>
      <div style="height:100%; overflow-y:hidden;">
        <ul id="transactionList" style="padding:0;list-style:none;margin:0;"></ul>
      </div>
    `,
    {
      showCloseBtn: false,
      cornerTopMargin: 0,
      cornerTopRadius: 0,
      hasVerticalScroll: false,
      closeBtnCenter: false,
    }
  );
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
      console.error("Ошибка истории:", data.error);
    }
  } catch (err) {
    console.error("Ошибка fetchTransactionHistory:", err);
  } finally {
    hideGlobalLoading();
  }
}

/**************************************************
 * displayTransactionHistory + getDateLabel
 **************************************************/
function displayTransactionHistory(transactions) {
  const list = document.getElementById("transactionList");
  if (!list) return;
  list.innerHTML = "";

  if (!transactions.length) {
    list.innerHTML = "<li>Нет операций</li>";
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
    const dateItem = document.createElement("li");
    dateItem.style.listStyle = "none";
    dateItem.style.marginTop = "20px";
    dateItem.style.padding = "0";

    const dateHeader = document.createElement("div");
    dateHeader.textContent = dateStr;
    dateHeader.style.fontWeight = "bold";
    dateHeader.style.marginBottom = "10px";
    dateHeader.style.fontSize = "16px";
    dateHeader.style.color = "#333";
    dateItem.appendChild(dateHeader);

    groups[dateStr].forEach((tx) => {
      const timeStr = new Date(tx.client_time || tx.created_at).toLocaleTimeString(
        "ru-RU"
      );

      let iconSrc = "";
      let titleText = "";
      let detailsText = "";
      let amountSign = "";
      let amountValue = formatBalance(tx.amount || 0);

      if (tx.type === "merchant_payment") {
        iconSrc = "90.png";
        titleText = "Оплата по QR";
        detailsText = `Мерчант: ${
          tx.merchant_id ||
          (tx.to_user_id && tx.to_user_id.replace("MERCHANT:", "")) ||
          "???"
        }`;
        amountSign = "-";
      } else if (tx.from_user_id === currentUserId) {
        iconSrc = "67.png";
        titleText = "Отправлено";
        detailsText = `Кому: ${tx.to_user_id}`;
        amountSign = "-";
      } else if (tx.to_user_id === currentUserId) {
        iconSrc = "66.png";
        titleText = "Получено";
        detailsText = `От кого: ${tx.from_user_id}`;
        amountSign = "+";
      } else if (tx.type === "exchange") {
        iconSrc = "67.png";
        titleText = "Обмен";
        detailsText = `Направление: ${
          tx.direction === "rub_to_coin" ? "Рубли → Монеты" : "Монеты → Рубли"
        }`;
        amountSign = tx.direction === "rub_to_coin" ? "+" : "-";
        amountValue = formatBalance(tx.amount);
      } else {
        iconSrc = "67.png";
        titleText = "Операция";
        detailsText = "Детали не указаны";
      }

      const cardDiv = document.createElement("div");
      cardDiv.style.background = "#f7f7f7";
      cardDiv.style.borderRadius = "8px";
      cardDiv.style.display = "flex";
      cardDiv.style.alignItems = "center";
      cardDiv.style.padding = "10px";
      cardDiv.style.marginBottom = "8px";

      const leftDiv = document.createElement("div");
      leftDiv.style.width = "44px";
      leftDiv.style.height = "44px";
      leftDiv.style.minWidth = "44px";
      leftDiv.style.minHeight = "44px";
      leftDiv.style.borderRadius = "50%";
      leftDiv.style.background = "#eeeeee";
      leftDiv.style.display = "flex";
      leftDiv.style.alignItems = "center";
      leftDiv.style.justifyContent = "center";
      leftDiv.style.marginRight = "10px";

      const iconImg = document.createElement("img");
      iconImg.src = iconSrc;
      iconImg.alt = "icon";
      iconImg.style.width = "24px";
      iconImg.style.height = "24px";
      leftDiv.appendChild(iconImg);

      const centerDiv = document.createElement("div");
      centerDiv.style.flex = "1";

      const titleEl = document.createElement("div");
      titleEl.textContent = titleText;
      titleEl.style.fontWeight = "bold";
      titleEl.style.marginBottom = "4px";

      const detailsEl = document.createElement("div");
      detailsEl.textContent = detailsText;
      detailsEl.style.fontSize = "14px";
      detailsEl.style.color = "#666";

      centerDiv.appendChild(titleEl);
      centerDiv.appendChild(detailsEl);

      const rightDiv = document.createElement("div");
      rightDiv.style.display = "flex";
      rightDiv.style.flexDirection = "column";
      rightDiv.style.alignItems = "flex-end";

      const amountEl = document.createElement("div");
      amountEl.style.fontWeight = "bold";
      let color = "#000";
      if (amountSign === "+") color = "green";
      else if (amountSign === "-") color = "red";
      amountEl.style.color = color;
      amountEl.textContent = `${amountSign} ${amountValue} ₲`;

      const timeEl = document.createElement("div");
      timeEl.textContent = timeStr;
      timeEl.style.fontSize = "12px";
      timeEl.style.color = "#888";
      timeEl.style.marginTop = "3px";

      rightDiv.appendChild(amountEl);
      rightDiv.appendChild(timeEl);

      cardDiv.appendChild(leftDiv);
      cardDiv.appendChild(centerDiv);
      cardDiv.appendChild(rightDiv);

      dateItem.appendChild(cardDiv);
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
  removeAllModals();
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
      document.getElementById("merchantBalanceValue").textContent =
        parseFloat(data.balance).toFixed(5);
    }
  } catch (err) {
    console.error("fetchMerchantBalance:", err);
  }
}

/* Создать QR (мерчант) */
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
    `,
    {
      showCloseBtn: true,
      cornerTopMargin: 50,
      cornerTopRadius: 20,
      hasVerticalScroll: true,
      closeBtnCenter: true,
    }
  );

  document.getElementById("createQRBtn").onclick = () => {
    const amount = parseFloat(document.getElementById("qrAmountInput").value);
    const purpose = document.getElementById("qrPurposeInput").value || "";
    if (!amount || amount <= 0) {
      alert("Некорректная сумма");
      return;
    }
    document.getElementById("createOneTimeQRModal")?.remove();
    createMerchantQR(amount, purpose);
  };
}

function calcRubEquivalent() {
  const coinVal = parseFloat(document.getElementById("qrAmountInput").value) || 0;
  const rubMultiplier = 1 + currentHalvingStep * 0.02;
  const rubVal = coinVal * rubMultiplier;
  document.getElementById("qrRubEquivalent").textContent = "≈ " + rubVal.toFixed(2) + " RUB";
}

function createMerchantQR(amount, purpose) {
  const qrData = `guga://merchantId=${currentMerchantId}&amount=${amount}&purpose=${encodeURIComponent(
    purpose
  )}`;
  createModal(
    "merchantQRModal",
    `
      <div id="merchantQRModalContainer"></div>
      <p style="margin-top:10px;">Запрашиваемая сумма: ${amount} ₲</p>
    `,
    {
      showCloseBtn: true,
      cornerTopMargin: 50,
      cornerTopRadius: 20,
      hasVerticalScroll: true,
      closeBtnCenter: true,
    }
  );
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
    document.getElementById("merchantQRModalContainer").textContent =
      "QR data: " + qrData;
  }
  monitorPayment(qrData);
}

function monitorPayment(qrData) {
  const timer = setInterval(async () => {
    try {
      const resp = await fetch(
        `${API_URL}/checkPaymentStatus?merchantId=${currentMerchantId}&qrData=${encodeURIComponent(
          qrData
        )}`,
        { credentials: "include" }
      );
      const data = await resp.json();
      if (data.success && data.paid) {
        clearInterval(timer);
        document.getElementById("merchantQRModal")?.remove();
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
    `,
    {
      showCloseBtn: true,
      cornerTopMargin: 50,
      cornerTopRadius: 20,
      hasVerticalScroll: true,
      closeBtnCenter: true,
    }
  );

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
        document.getElementById("merchantTransferModal")?.remove();
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
 * УДАЛИТЬ ВСЕ МОДАЛКИ
 **************************************************/
function removeAllModals() {
  const modals = document.querySelectorAll(".modal");
  modals.forEach((m) => m.remove());
}

/**************************************************
 * СПРЯТАТЬ ГЛАВНУЮ UI (для мерчанта)
 **************************************************/
function hideMainUI() {
  const balanceDisplay = document.getElementById("balanceDisplay");
  if (balanceDisplay) balanceDisplay.style.display = "none";
  const mineContainer = document.getElementById("mineContainer");
  if (mineContainer) mineContainer.style.display = "none";
  const actionContainer = document.getElementById("actionButtonsContainer");
  if (actionContainer) actionContainer.remove();
}

/**************************************************
 * ПАРСИНГ QR (требуется реализация сканера)
 **************************************************/
function startUniversalQRScanner(videoElement, onResultCallback) {
  // Заглушка. Здесь должен быть код инициализации QR-сканера,
  // который после считывания вызывает onResultCallback(decodedString).
  // В реальном проекте используйте, например, jsQR или ZXing.
  console.log("QR Scanner started (stub).");
}

function parseMerchantQRData(qrString) {
  // Пример QR: guga://merchantId=MERCH123&amount=12.34&purpose=Some%20Text
  const obj = { merchantId: null, amount: 0, purpose: "" };
  try {
    if (!qrString.startsWith("guga://")) return obj;
    const query = qrString.replace("guga://", "");
    const parts = query.split("&");
    for (const p of parts) {
      const [key, val] = p.split("=");
      if (key === "merchantId") obj.merchantId = val;
      if (key === "amount") obj.amount = parseFloat(val);
      if (key === "purpose") obj.purpose = decodeURIComponent(val);
    }
  } catch (e) {
    console.error("parseMerchantQRData error:", e);
  }
  return obj;
}

/**************************************************
 * DOMContentLoaded
 **************************************************/
document.addEventListener("DOMContentLoaded", () => {
  // Пытаемся получить данные о пользователе
  fetchUserData().then(() => {
    if (currentMerchantId) {
      openMerchantUI();
    } else if (currentUserId) {
      createMainUI();
    } else {
      openAuthModal();
    }
  });

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

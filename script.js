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
 * CSS АНИМАЦИИ
 **************************************************/
const globalStyle = document.createElement("style");
globalStyle.textContent = `
  /*===== СТАРЫЕ АНИМАЦИИ: СНИЗУ, СВЕРХУ, SWAP-ROTATE =====*/
  @keyframes slideUp {
    0%   { transform: translateY(100%); }
    100% { transform: translateY(0); }
  }
  .modal-slide-up {
    animation: slideUp 0.3s ease forwards;
  }

  @keyframes slideDown {
    0%   { transform: translateY(0); }
    100% { transform: translateY(100%); }
  }
  .modal-slide-down {
    animation: slideDown 0.3s ease forwards;
  }

  .swap-rotate {
    transition: transform 0.3s ease;
    transform: rotate(360deg);
  }

  /*===== ОТКРЫТИЕ ПРОФИЛЯ "СВЕРХУ ВНИЗ" =====*/
  @keyframes slideFromTop {
    0%   { transform: translateY(-100%); }
    100% { transform: translateY(0); }
  }
  .modal-slide-from-top {
    animation: slideFromTop 0.3s ease forwards;
  }

  /*===== ЗАКРЫТИЕ ПРОФИЛЯ "К ВЕРХУ" =====*/
  @keyframes slideToTop {
    0%   { transform: translateY(0); }
    100% { transform: translateY(-100%); }
  }
  .modal-slide-to-top {
    animation: slideToTop 0.3s ease forwards;
  }

  /*===== ГОРИЗОНТАЛЬНЫЕ АНИМАЦИИ ДЛЯ ПЕРЕКЛЮЧЕНИЯ (БЕЗ ПАУЗЫ) =====*/
  @keyframes slideInRight {
    0%   { transform: translateX(100%); }
    100% { transform: translateX(0); }
  }
  .modal-slide-in-right {
    animation: slideInRight 0.3s ease forwards;
  }

  @keyframes slideOutLeft {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-100%); }
  }
  .modal-slide-out-left {
    animation: slideOutLeft 0.3s ease forwards;
  }

  @keyframes slideInLeft {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(0); }
  }
  .modal-slide-in-left {
    animation: slideInLeft 0.3s ease forwards;
  }

  @keyframes slideOutRight {
    0%   { transform: translateX(0); }
    100% { transform: translateX(100%); }
  }
  .modal-slide-out-right {
    animation: slideOutRight 0.3s ease forwards;
  }
`;
document.head.appendChild(globalStyle);

/**************************************************
 * УТИЛИТЫ
 **************************************************/
function formatBalance(num, decimals = 5) {
  const parsed = parseFloat(num);
  if (isNaN(parsed)) {
    return (0).toFixed(decimals); // Если некорректно -> "0.00000"
  }
  return parsed.toFixed(decimals);
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
 * АНИМАЦИЯ ЗАКРЫТИЯ ВНИЗ (ДЛЯ "ГЛАВНАЯ" / ОСТАЛЬНОГО)
 **************************************************/
function closeModalWithAnimation(modalId) {
  const modalEl = document.getElementById(modalId);
  if (!modalEl) return;
  const content = modalEl.querySelector(".modal-content");
  if (!content) {
    modalEl.remove();
    return;
  }
  // Убираем все предыдущие классы открытия:
  content.classList.remove(
    "modal-slide-up",
    "modal-slide-from-top",
    "modal-slide-in-right",
    "modal-slide-in-left",
    "modal-slide-out-left",
    "modal-slide-out-right",
    "modal-slide-to-top"
  );
  // Добавляем slide-down (закрытие вниз):
  content.classList.add("modal-slide-down");
  content.addEventListener(
    "animationend",
    () => {
      modalEl.remove();
    },
    { once: true }
  );
}

/**************************************************
 * "ЗАКРЫТЬ ПРОФИЛЬ НАВЕРХ"
 **************************************************/
function closeProfileToTop(modalId) {
  const modalEl = document.getElementById(modalId);
  if (!modalEl) return;
  const content = modalEl.querySelector(".modal-content");
  if (!content) {
    modalEl.remove();
    return;
  }
  // Убираем все классы:
  content.classList.remove(
    "modal-slide-up",
    "modal-slide-down",
    "modal-slide-from-top",
    "modal-slide-in-right",
    "modal-slide-in-left",
    "modal-slide-out-left",
    "modal-slide-out-right"
  );
  // Добавляем slideToTop:
  content.classList.add("modal-slide-to-top");
  content.addEventListener(
    "animationend",
    () => {
      modalEl.remove();
    },
    { once: true }
  );
}

/**************************************************
 * ГОРИЗОНТАЛЬНОЕ ПЕРЕКЛЮЧЕНИЕ (ОДНОВРЕМЕННО) 
 * БЕЗ СЕРОЙ ПЕЛЕНЫ СВЕРХУ
 **************************************************/
function switchHistoryExchange(oldId, newModalFn, direction) {
  const oldModal = document.getElementById(oldId);
  if (!oldModal) {
    removeAllModals();
    newModalFn();
    return;
  }
  const oldContent = oldModal.querySelector(".modal-content");

  // 1) Создаём новую модалку "в фоне", но убираем у неё overlay 
  //    (чтобы не было дополнительной "серы пелены").
  //    Сразу после создания тоже выставим newModal.style.background = 'transparent'
  //    до окончания анимации.
  newModalFn(true); // Доп.параметр (horizontalSwitch=true), см. ниже.

  const newId = direction === "toExchange" ? "exchangeModal" : "historyModal";
  const newModal = document.getElementById(newId);
  if (!newModal) return;
  const newContent = newModal.querySelector(".modal-content");

  // Ставим у нового modal.background в "transparent", убираем overlay.
  newModal.style.background = "transparent";
  const newOverlay = newModal.querySelector("div:nth-child(1)");
  if (newOverlay) {
    newOverlay.style.background = "transparent";
    newOverlay.style.pointerEvents = "none"; // чтобы клики сквозь
  }

  // 2) Повышаем zIndex старого окна, чтобы оно было "сверху".
  oldModal.style.zIndex = "100002";
  newModal.style.zIndex = "100001";

  // 3) Запускаем анимации одновременно:
  if (direction === "toExchange") {
    oldContent.classList.remove("modal-slide-in-left", "modal-slide-in-right");
    oldContent.classList.add("modal-slide-out-left");
    newContent.classList.remove("modal-slide-up");
    newContent.classList.remove("modal-slide-in-left", "modal-slide-in-right");
    newContent.classList.add("modal-slide-in-right");
  } else {
    oldContent.classList.remove("modal-slide-in-left", "modal-slide-in-right");
    oldContent.classList.add("modal-slide-out-right");
    newContent.classList.remove("modal-slide-up");
    newContent.classList.remove("modal-slide-in-left", "modal-slide-in-right");
    newContent.classList.add("modal-slide-in-left");
  }

  // 4) Когда старая анимация завершилась — убираем старую модалку, 
  //    а у новой возвращаем "затемнение" overlay
  oldContent.addEventListener(
    "animationend",
    () => {
      oldModal.remove();
      // Возвращаем overlay для нового:
      newModal.style.background = "rgba(0,0,0,0.5)";
      if (newOverlay) {
        newOverlay.style.background = "transparent"; 
        // Или поставить rgba(0,0,0,0.5), если хотите затемнение. 
        // Но при переключении это может быть не нужно. 
        // Можно вообще оставить прозрачным, если нужно.
        newOverlay.style.pointerEvents = "auto";
      }
    },
    { once: true }
  );
}

/**************************************************
 * СОЗДАНИЕ / ОТКРЫТИЕ МОДАЛОК 
 **************************************************/
/**
 * createModal(id, innerHtml, {
 *   showCloseBtn,      
 *   cornerTopMargin,   
 *   cornerTopRadius,   
 *   hasVerticalScroll, 
 *   profileFromTop,    
 *   defaultFromBottom, 
 *   horizontalSwitch,  
 *   noRadiusByDefault  // если true, убираем радиус у модалки
 * })
 */
function createModal(
  id,
  innerHtml,
  {
    showCloseBtn = false,
    cornerTopMargin = 0,
    cornerTopRadius = 0,
    hasVerticalScroll = true,
    profileFromTop = false,
    defaultFromBottom = true,
    horizontalSwitch = false,
    noRadiusByDefault = false,
  } = {}
) {
  // Удаляем старый, если есть
  const old = document.getElementById(id);
  if (old) old.remove();

  const modal = document.createElement("div");
  modal.id = id;
  modal.className = "modal";
  modal.style.zIndex = "100000";
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100%";
  modal.style.height = "100%";
  // По умолчанию делаем фон (затемнение), 
  // но при горизонтальном переключении можем временно ставить transparent (выше).
  modal.style.background = "rgba(0,0,0,0.5)";
  modal.style.display = "flex";
  modal.style.flexDirection = "column";
  modal.style.justifyContent = "flex-start";
  modal.style.alignItems = "stretch";

  // overlay
  const overlay = document.createElement("div");
  overlay.style.position = "absolute";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0,0,0,0)"; // внутри modal, уже есть общий фон

  // Определяем анимацию открытия:
  let openAnim = "";
  if (profileFromTop) {
    openAnim = "modal-slide-from-top";
  } else if (defaultFromBottom) {
    openAnim = "modal-slide-up";
  }
  // (horizontalSwitch) — управляется switchHistoryExchange()

  const contentDiv = document.createElement("div");
  contentDiv.className = "modal-content" + (openAnim ? ` ${openAnim}` : "");
  contentDiv.style.marginTop = `${cornerTopMargin}px`;
  contentDiv.style.width = "100%";
  contentDiv.style.height = `calc(100% - ${cornerTopMargin}px)`;
  contentDiv.style.background = "#fff";
  contentDiv.style.boxSizing = "border-box";
  contentDiv.style.overflowY = hasVerticalScroll ? "auto" : "hidden";
  contentDiv.style.position = "relative";
  contentDiv.style.padding = "20px";

  // Если "noRadiusByDefault" = true => убираем радиус.
  // Иначе используем cornerTopRadius
  if (noRadiusByDefault) {
    contentDiv.style.borderRadius = "0";
  } else if (cornerTopRadius > 0) {
    // Модалки "Перевести" и "Оплата" оставляем радиус, как просили
    contentDiv.style.borderRadius = `${cornerTopRadius}px ${cornerTopRadius}px 0 0`;
  }

  // closeBtn
  let closeBtnHtml = "";
  if (showCloseBtn) {
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
        cursor:pointer;
        display:flex;
        align-items:center;
        justify-content:center;">
        ×
      </button>
    `;
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
        if (id === "profileModal") {
          closeProfileToTop(id);
        } else {
          closeModalWithAnimation(id);
        }
      });
    }
  }

  return modal;
}

/**************************************************
 * АВТОРИЗАЦИЯ / РЕГИСТРАЦИЯ
 **************************************************/
/**
 * Функция для запроса одноразового кода для привязки Telegram в режиме регистрации.
 * Отправляем { forRegistration: true, username } в тело запроса.
 * Если сервер возвращает код (для тестирования), он отображается в поле.
 */
async function requestTelegramCodeForRegistration() {
  const username = document.getElementById("regLogin").value;
  if (!username) {
    alert("❌ Введите логин для запроса кода");
    return;
  }
  // Генерация 6-значного кода на клиенте
  const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
  try {
    const resp = await fetch(`${API_URL}/telegram/request-code`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      // Передаём сгенерированный код в теле запроса
      body: JSON.stringify({ forRegistration: true, username, code: generatedCode })
    });
    const data = await resp.json();
    console.log("Ответ от /telegram/request-code:", data);
    if (resp.ok && data.success) {
      const codeDisplayElem = document.getElementById("telegramCodeDisplay");
      // Отображаем сгенерированный код на странице
      codeDisplayElem.textContent = "Ваш код: " + generatedCode;
      alert("Код сгенерирован и отправлен в Telegram. Проверьте ваш Telegram-бот для подтверждения.");
    } else {
      alert(`Ошибка запроса кода: ${data.error}`);
    }
  } catch (err) {
    console.error("Ошибка запроса кода Telegram:", err);
    alert("Ошибка запроса кода Telegram.");
  }
}

/**
 * Функция для проверки привязки Telegram в режиме регистрации.
 * Отправляем GET-запрос на endpoint /telegram/check-bound с параметром username.
 * Если проверка успешна, устанавливаем флаг и разблокируем кнопку регистрации.
 */
async function checkTelegramBoundForRegistration() {
  const username = document.getElementById("regLogin").value;
  if (!username) {
    alert("❌ Введите логин для проверки привязки");
    return;
  }
  try {
    const resp = await fetch(`${API_URL}/telegram/check-bound?username=${encodeURIComponent(username)}`, {
      method: "GET",
      credentials: "include"
    });
    const data = await resp.json();
    if (resp.ok && data.success) {
      window.isTelegramBound = true;
      const regBtn = document.getElementById("registerSubmitBtn");
      if (regBtn) regBtn.disabled = false;
      alert("Telegram успешно привязан! Теперь можно завершить регистрацию.");
    } else {
      alert(`Проверка привязки не пройдена: ${data.error}`);
    }
  } catch (err) {
    console.error("Ошибка проверки привязки Telegram:", err);
    alert("Ошибка проверки привязки Telegram.");
  }
}

/* Пример функций login, register, logout, openAuthModal остаются почти без изменений */

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
      credentials: "include", // передаем cookie с токеном
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
      // Пробуем мерчанта
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
  // Если Telegram не привязан, регистрация недоступна
  if (!window.isTelegramBound) {
    alert("❌ Сначала привяжите свой Telegram аккаунт");
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
 * ОКНО АВТОРИЗАЦИИ
 **************************************************/
function openAuthModal() {
  hideMainUI();
  removeAllModals();

  createModal(
    "authModal",
    `
      <div style="
        background:#f7f7f7;
        border-radius:20px;
        padding:20px;
        max-width:400px;
        margin:40px auto 0 auto;
        box-shadow:0 2px 5px rgba(0,0,0,0.1);
        display:flex;
        flex-direction:column;
        gap:16px;
      ">
        <h2 style="text-align:center; margin:0;">GUGACOIN</h2>

        <!-- Блок Входа -->
        <div id="loginSection" style="display:flex; flex-direction:column; gap:8px;">
          <h4 style="margin:0; text-align:center;">Вход</h4>
          <input type="text" id="loginInput" placeholder="Логин" style="padding:10px; font-size:16px; width:100%; border:none; border-radius:8px; outline:none;">
          <input type="password" id="passwordInput" placeholder="Пароль" style="padding:10px; font-size:16px; width:100%; border:none; border-radius:8px; outline:none;">
          <button id="loginSubmitBtn" style="padding:10px; margin-top:4px; border:none; border-radius:8px; font-size:16px; background:#000; color:#fff; cursor:pointer;">
            Войти
          </button>
        </div>

        <!-- Блок Регистрации (изначально скрыт) -->
        <div id="registerSection" style="display:none; flex-direction:column; gap:8px;">
          <h4 style="margin:0; text-align:center;">Регистрация</h4>
          <input type="text" id="regLogin" placeholder="Логин" style="padding:10px; font-size:16px; width:100%; border:none; border-radius:8px; outline:none;">
          <input type="password" id="regPassword" placeholder="Пароль" style="padding:10px; font-size:16px; width:100%; border:none; border-radius:8px; outline:none;">
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button id="requestTelegramBtn" style="flex:1 1 auto; padding:10px; border:none; border-radius:8px; font-size:16px; background:#007bff; color:#fff; cursor:pointer;">
              Запросить код
            </button>
            <button id="checkTelegramBtn" style="flex:1 1 auto; padding:10px; border:none; border-radius:8px; font-size:16px; background:#28a745; color:#fff; cursor:pointer;">
              Проверить привязку
            </button>
          </div>
          <!-- Поле для отображения кода (только код, крупно) -->
          <div id="telegramCodeDisplay" style="padding:12px; border:1px solid #ccc; border-radius:8px; text-align:center; font-size:24px; font-weight:bold; color:#333;"></div>
          <button id="registerSubmitBtn" style="padding:10px; margin-top:4px; border:none; border-radius:8px; font-size:16px; background:#000; color:#fff; cursor:pointer;" disabled>
            Зарегистрироваться
          </button>
        </div>

        <!-- Кнопка переключения между "Вход" и "Регистрация" -->
        <button id="toggleAuthBtn" style="margin-top:10px; border:none; border-radius:8px; font-size:14px; padding:8px; background:#eee; cursor:pointer;">
          Войти / Зарегистрироваться
        </button>
      </div>
    `,
    {
      showCloseBtn: false,
      cornerTopMargin: 0,
      cornerTopRadius: 0,
      hasVerticalScroll: true,
      defaultFromBottom: true,
      noRadiusByDefault: true
    }
  );

  document.getElementById("loginSubmitBtn").addEventListener("click", login);
  document.getElementById("registerSubmitBtn").addEventListener("click", register);
  document.getElementById("toggleAuthBtn").addEventListener("click", () => {
    const loginSection = document.getElementById("loginSection");
    const registerSection = document.getElementById("registerSection");
    if (loginSection.style.display === "none") {
      loginSection.style.display = "flex";
      registerSection.style.display = "none";
    } else {
      loginSection.style.display = "none";
      registerSection.style.display = "flex";
      // Сброс привязки Telegram
      window.isTelegramBound = false;
      const regBtn = document.getElementById("registerSubmitBtn");
      if (regBtn) regBtn.disabled = true;
      const bindBtn = document.getElementById("requestTelegramBtn");
      if (bindBtn) {
        bindBtn.textContent = "Запросить код";
        bindBtn.disabled = false;
      }
      const codeDisplay = document.getElementById("telegramCodeDisplay");
      if (codeDisplay) codeDisplay.textContent = "";
    }
  });
  
  document.getElementById("requestTelegramBtn").addEventListener("click", requestTelegramCodeForRegistration);
  document.getElementById("checkTelegramBtn").addEventListener("click", checkTelegramBoundForRegistration);

  // Изначально показываем блок "Вход"
  document.getElementById("loginSection").style.display = "flex";
  document.getElementById("registerSection").style.display = "none";
}

/**
 * Функция запроса кода для привязки Telegram в режиме регистрации.
 * Сервер возвращает объект { success: true, code: "123456" } для тестирования.
 * Код отображается в поле с id "telegramCodeDisplay" (только цифры, крупный шрифт).
 */
async function requestTelegramCodeForRegistration() {
  const username = document.getElementById("regLogin").value;
  if (!username) {
    alert("❌ Введите логин для запроса кода");
    return;
  }
  try {
    const resp = await fetch(`${API_URL}/telegram/request-code`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forRegistration: true, username })
    });
    const data = await resp.json();
    console.log("Ответ от /telegram/request-code:", data);
    if (resp.ok && data.success) {
      const codeDisplayElem = document.getElementById("telegramCodeDisplay");
      if (data.code) {
        codeDisplayElem.textContent = data.code;
      } else {
        codeDisplayElem.textContent = "";
      }
      alert("Код сгенерирован. Отправьте его нашему Telegram-боту и затем нажмите 'Проверить привязку'.");
    } else {
      alert(`Ошибка запроса кода: ${data.error}`);
    }
  } catch (err) {
    console.error("Ошибка запроса кода Telegram:", err);
    alert("Ошибка запроса кода Telegram.");
  }
}

/**
 * Функция проверки привязки Telegram в режиме регистрации.
 * Если проверка проходит успешно, активируется кнопка регистрации.
 */
async function checkTelegramBoundForRegistration() {
  const username = document.getElementById("regLogin").value;
  if (!username) {
    alert("❌ Введите логин для проверки привязки");
    return;
  }
  try {
    const resp = await fetch(`${API_URL}/telegram/check-bound?username=${encodeURIComponent(username)}`, {
      method: "GET",
      credentials: "include"
    });
    const data = await resp.json();
    console.log("Ответ от /telegram/check-bound:", data);
    if (resp.ok && data.success) {
      window.isTelegramBound = true;
      const regBtn = document.getElementById("registerSubmitBtn");
      if (regBtn) regBtn.disabled = false;
      alert("Telegram успешно привязан! Теперь можно завершить регистрацию.");
    } else {
      alert(`Проверка привязки не пройдена: ${data.error}`);
    }
  } catch (err) {
    console.error("Ошибка проверки привязки Telegram:", err);
    alert("Ошибка проверки привязки Telegram.");
  }
}

/**************************************************
 * ГЛАВНЫЙ ЭКРАН
 **************************************************/
function createMainUI() {
  if (!currentMerchantId && !document.getElementById("profileIcon")) {
    const profileIcon = document.createElement("img");
    profileIcon.id = "profileIcon";
    profileIcon.src = "68.png";
    profileIcon.style.width = "40px";
    profileIcon.style.height = "40px";
    profileIcon.style.position = "fixed";
    profileIcon.style.top = "10px";
    profileIcon.style.right = "10px";
    profileIcon.style.cursor = "pointer";
    profileIcon.style.zIndex = "90000";
    document.body.appendChild(profileIcon);

    profileIcon.addEventListener("click", openProfileModal);
  }

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
    bottomBar.style.padding = "0px"; // убран padding
    bottomBar.style.boxShadow = "0 -2px 5px rgba(0,0,0,0.1)";
    bottomBar.style.zIndex = "999999";

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

    // "Главная" => закрыть "История"/"Обмен" (анимация вниз)
    document.getElementById("btnMain").addEventListener("click", () => {
      if (document.getElementById("historyModal")) {
        closeModalWithAnimation("historyModal");
      }
      if (document.getElementById("exchangeModal")) {
        closeModalWithAnimation("exchangeModal");
      }
    });

    // "История"
    document.getElementById("historyBtn").addEventListener("click", () => {
      if (document.getElementById("exchangeModal")) {
        // Переключение: "Обмен" -> "История"
        switchHistoryExchange("exchangeModal", () => openHistoryModal(true), "toHistory");
      } else {
        removeAllModals();
        openHistoryModal(false);
      }
    });

    // "Обмен"
    document.getElementById("exchangeBtn").addEventListener("click", () => {
      if (document.getElementById("historyModal")) {
        // Переключение: "История" -> "Обмен"
        switchHistoryExchange("historyModal", () => openExchangeModal(true), "toExchange");
      } else {
        removeAllModals();
        openExchangeModal(false);
      }
    });
  }

  // Баланс / Майнинг
  const balanceDisplay = document.getElementById("balanceDisplay");
  if (balanceDisplay) {
    balanceDisplay.style.display = "block";
  }
  const mineContainer = document.getElementById("mineContainer");
  if (mineContainer) {
    // Скрываем кнопку майнинга
    mineContainer.style.display = "none";
  }

  // Кнопки "Перевести" / "Оплата"
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
    container.style.margintop = "25px";

    container.innerHTML = `
      <button id="transferBtn" style="padding:10px;border:none;background:none;font-size:14px;display:flex;flex-direction:column;align-items:center;gap:4px;">
        <img src="81.png" style="width:35px;height:35px;">
        Перевести
      </button>
      <button id="payQRBtn" style="padding:10px;border:none;background:none;font-size:14px;display:flex;flex-direction:column;align-items:center;gap:4px;margin-top: -5px;">
        <img src="90.png" style="width:40px;height:40px;">
        Оплатить
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
 * ПОЛЬЗОВАТЕЛЬ
 **************************************************/
async function fetchUserData() {
  try {
    const resp = await fetch(`${API_URL}/user`, { credentials: "include" });
    const data = await resp.json();
    if (data.success && data.user) {
      currentUserId = data.user.user_id;
      currentUserName = data.user.username;  // Сохраняем логин пользователя
      const coinBalance = data.user.balance || 0;
      const rubBalance = data.user.rub_balance || 0;

      const balanceValue = document.getElementById("balanceValue");
      if (balanceValue) {
        balanceValue.textContent = formatBalance(coinBalance, 5) + " ₲";
      }
      const userIdEl = document.getElementById("userIdDisplay");
      if (userIdEl) {
        userIdEl.textContent = "ID: " + currentUserId;
      }
      const rubBalanceInfo = document.getElementById("rubBalanceInfo");
      if (rubBalanceInfo) {
        rubBalanceInfo.textContent = formatBalance(rubBalance, 2) + " ₽";
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
  pendingMinedCoins += 0.00001;
  console.log("Mined: ", pendingMinedCoins);
}

async function flushMinedCoins() {
  if (pendingMinedCoins <= 0) return;
  try {
    const resp = await fetch(`${API_URL}/update`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: pendingMinedCoins }),
    });
    if (resp.ok) {
      // Сервер подтверждает успех
      pendingMinedCoins = 0;
      console.log("Coins flushed successfully");
    } else {
      console.error("Server refused flush");
    }
  } catch (e) {
    console.error("flushMinedCoins error:", e);
  }
}

/**************************************************
 * ПРОФИЛЬ
 **************************************************/
// Изменённая функция openProfileModal:
function openBindTelegramModal() {
  createModal(
    "bindTelegramModal",
    `
      <h3 style="text-align:center;">Привязка Telegram</h3>
      <p style="text-align:center;">Запросите код для привязки вашего Telegram-аккаунта.</p>
      <div style="display:flex; flex-direction:column; gap:10px;">
         <button id="requestBindTelegramBtn" style="padding:10px; border:none; border-radius:8px; background:#007bff; color:#fff; cursor:pointer;">
           Запросить код
         </button>
         <div id="bindTelegramCodeDisplay" style="text-align:center; font-size:20px; font-weight:bold;"></div>
         <input type="text" id="bindTelegramCodeInput" placeholder="Введите код" style="padding:10px; border:1px solid #ccc; border-radius:8px; font-size:16px;"/>
         <button id="checkBindTelegramBtn" style="padding:10px; border:none; border-radius:8px; background:#28a745; color:#fff; cursor:pointer;">
           Проверить привязку
         </button>
      </div>
    `,
    {
      showCloseBtn: true,
      cornerTopMargin: 50,
      cornerTopRadius: 20,
      hasVerticalScroll: false,
      defaultFromBottom: true,
      noRadiusByDefault: false
    }
  );
  
  // Генерация кода на клиенте и отправка на сервер
  document.getElementById("requestBindTelegramBtn").addEventListener("click", async () => {
    const loginName = currentUserName;
    if (!loginName) return alert("Логин не найден, перезагрузите страницу.");
    // Генерируем 6-значный код
    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    try {
      const resp = await fetch(`${API_URL}/telegram/request-code`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        // Отправляем сгенерированный код вместе с логином; forRegistration: false для привязки уже существующего аккаунта
        body: JSON.stringify({ forRegistration: false, username: loginName, code: generatedCode })
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        // Отображаем сгенерированный код
        const codeDisplayElem = document.getElementById("bindTelegramCodeDisplay");
        if (codeDisplayElem) {
          codeDisplayElem.textContent = "Ваш код: " + generatedCode;
        }
        alert("Код сгенерирован и отправлен через Telegram-бота. Проверьте ваш Telegram.");
      } else {
        alert("Ошибка запроса кода: " + data.error);
      }
    } catch (err) {
      console.error("Ошибка запроса кода:", err);
      alert("Ошибка запроса кода.");
    }
  });
  
  // Проверка привязки без запроса логина через prompt (используем currentUserName)
  document.getElementById("checkBindTelegramBtn").addEventListener("click", async () => {
    const loginName = currentUserName;
    if (!loginName) return alert("Логин не найден, перезагрузите страницу.");
    try {
      const resp = await fetch(`${API_URL}/telegram/check-bound?username=${encodeURIComponent(loginName)}`, {
        method: "GET",
        credentials: "include"
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        alert("Telegram успешно привязан!");
        document.getElementById("bindTelegramModal")?.remove();
      } else {
        alert("Проверка привязки не пройдена: " + data.error);
      }
    } catch (err) {
      console.error("Ошибка проверки привязки:", err);
      alert("Ошибка проверки привязки.");
    }
  });
}

// Изменение в fetchUserData: сохраняем логин пользователя
async function fetchUserData() {
  try {
    const resp = await fetch(`${API_URL}/user`, { credentials: "include" });
    const data = await resp.json();
    if (data.success && data.user) {
      currentUserId = data.user.user_id;
      currentUserName = data.user.username; // Сохраняем логин
      const coinBalance = data.user.balance || 0;
      const rubBalance = data.user.rub_balance || 0;
      const balanceValue = document.getElementById("balanceValue");
      if (balanceValue) {
        balanceValue.textContent = formatBalance(coinBalance, 5) + " ₲";
      }
      const userIdEl = document.getElementById("userIdDisplay");
      if (userIdEl) {
        userIdEl.textContent = "ID: " + currentUserId;
      }
      const rubBalanceInfo = document.getElementById("rubBalanceInfo");
      if (rubBalanceInfo) {
        rubBalanceInfo.textContent = formatBalance(rubBalance, 2) + " ₽";
      }
    }
  } catch (err) {
    console.error("fetchUserData error:", err);
  }
}

/**************************************************
 * ПЕРЕВОД (здесь оставляем радиус) 
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
      cornerTopRadius: 20,   // радиус
      hasVerticalScroll: true,
      defaultFromBottom: true,
      noRadiusByDefault: false
    }
  );

  document.getElementById("sendTransferBtn").onclick = async () => {
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
 * ОПЛАТА ПО QR (также оставляем радиус)
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
      cornerTopRadius: 20,  // радиус
      hasVerticalScroll: true,
      defaultFromBottom: true,
      noRadiusByDefault: false
    }
  );

  const videoEl = document.getElementById("opPayVideo");
  startUniversalQRScanner(videoEl, (rawValue) => {
    const parsed = parseMerchantQRData(rawValue);
    if (!parsed.merchantId) {
      alert("❌ Неверный QR. Нет merchantId.");
      return;
    }
    // Сначала создаём окно подтверждения
    confirmPayMerchantModal(parsed);

    // А теперь закрываем окно сканера (через небольшую паузу, чтобы не конфликтовать с анимацией)
    setTimeout(() => {
      document.getElementById("payQRModal")?.remove();
    }, 500);
  });
}

function confirmPayMerchantModal({ merchantId, amount, purpose }) {
  createModal(
    "confirmPayMerchantModal",
    `
      <h3 style="text-align:center;">Подтверждение оплаты</h3>
      <p>Мерчант: ${merchantId}</p>
      <p>Сумма: ${formatBalance(amount, 5)} ₲</p>
      <p>Назначение: ${purpose}</p>
      <button id="confirmPayBtn" style="padding:10px;margin-top:10px;">Оплатить</button>
    `,
    {
      showCloseBtn: true,
      cornerTopMargin: 50,
      cornerTopRadius: 20, // радиус
      hasVerticalScroll: true,
      defaultFromBottom: true,
      noRadiusByDefault: false
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
 * ОБМЕН (без кнопки закрытия, без радиуса)
 **************************************************/
let currentExchangeDirection = "coin_to_rub";
let currentExchangeRate = 0;

function openExchangeModal(horizontalSwitch) {
  showGlobalLoading();
  createModal(
    "exchangeModal",
    `
      <h3 style="text-align:center;">Обменять</h3>

      <!-- Контейнер для графика с position:relative, чтобы разместить курс и стрелку сверху слева -->
      <div style="max-width:600px; margin:0 auto; background:rgb(247, 247, 247); 
                  padding:10px; border-radius:10px; position:relative;">

        <!-- Блок с «Текущий курс», стрелкой и процентом -->
        <div style="position:absolute; top:10px; left:10px; display:flex; flex-direction:column; gap:4px;">
          <!-- Текущий курс -->
          <div id="currentRateText" style="font-size:24px; font-weight:bold; margin-left: 10px;">
            --
          </div>
          <!-- Стрелка, проценты, разница в рублях -->
          <div style="display:flex; align-items:center; gap:12px;">
            <span id="rateChangeArrow" style="font-size:16px;">↑</span>
            <span id="rateChangePercent" style="font-size:16px;margin-left: -10px;">+0.00%</span>
            <span id="rateChangeRub" style="font-size:16px; color:#000;">+0.00₽</span>
          </div>
        </div>

        <!-- Canvas для графика -->
        <canvas id="exchangeChart" style="width:100%; max-height:200px; margin-top:70px;"></canvas>
      </div>

      <!-- Отдельный контейнер для полей обмена -->
      <div style="background:rgb(247, 247, 247); border-radius:10px; 
                  padding:10px; max-width:600px; margin:20px auto;">
        
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
      </div>
    `,
    {
      showCloseBtn: false,
      cornerTopMargin: 0,
      cornerTopRadius: 0,
      hasVerticalScroll: true,
      defaultFromBottom: true,
      noRadiusByDefault: true,
      horizontalSwitch: !!horizontalSwitch
    }
  );

  const swapBtn = document.getElementById("swapBtn");
  swapBtn.addEventListener("click", () => {
    swapBtn.classList.add("swap-rotate");
    setTimeout(() => swapBtn.classList.remove("swap-rotate"), 300);
    swapCurrencies();
  });

  loadBalanceAndExchangeRate()
    .then(() => {
      drawExchangeChart(); 
      document.getElementById("btnPerformExchange").onclick = () => {
        handleExchange(currentExchangeDirection);
      };
    })
    .catch((err) => {
      console.error("openExchangeModal error:", err);
    })
    .finally(() => {
      hideGlobalLoading();
    });
}

function updateExchange() {
  const amountInputVal = document.getElementById("amountInput").value.trim();
  const amount = parseFloat(amountInputVal);
  let result = 0;
  if (!isNaN(amount) && amount > 0 && currentExchangeRate) {
    if (currentExchangeDirection === "coin_to_rub") {
      result = amount * currentExchangeRate;
      document.getElementById("toAmount").value = formatBalance(result, 2);
    } else {
      result = amount / currentExchangeRate;
      document.getElementById("toAmount").value = formatBalance(result, 5);
    }
  } else {
    if (currentExchangeDirection === "coin_to_rub") {
      document.getElementById("toAmount").value = "0.00";
    } else {
      document.getElementById("toAmount").value = "0.00000";
    }
  }
}

function swapCurrencies() {
  currentExchangeDirection =
    currentExchangeDirection === "coin_to_rub" ? "rub_to_coin" : "coin_to_rub";
  updateCurrencyLabels();
  document.getElementById("amountInput").value = "";
  if (currentExchangeDirection === "coin_to_rub") {
    document.getElementById("toAmount").value = "0.00";
  } else {
    document.getElementById("toAmount").value = "0.00000";
  }
  loadBalanceAndExchangeRate();
}

function updateCurrencyLabels() {
  const fromLabel = document.getElementById("fromLabel");
  const toLabel = document.getElementById("toLabel");
  if (currentExchangeDirection === "coin_to_rub") {
    fromLabel.innerHTML = `<img src="15.png" alt="GUGA" style="width:25px;vertical-align:middle;"> GUGA`;
    toLabel.innerHTML   = `<img src="18.png" alt="RUB" style="width:25px;vertical-align:middle;"> RUB`;
  } else {
    fromLabel.innerHTML = `<img src="18.png" alt="RUB" style="width:25px;vertical-align:middle;"> RUB`;
    toLabel.innerHTML   = `<img src="15.png" alt="GUGA" style="width:25px;vertical-align:middle;"> GUGA`;
  }
}

async function handleExchange(direction) {
  const amountVal = parseFloat(document.getElementById("amountInput").value);
  if (isNaN(amountVal) || amountVal <= 0) {
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
      body: JSON.stringify({ direction, amount: amountVal }),
    });
    const data = await resp.json();
    if (data.success) {
      let msg = "";
      if (direction === "rub_to_coin") {
        msg = `${formatBalance(amountVal, 2)} ₽ → ${formatBalance(data.exchanged_amount, 5)} ₲`;
      } else {
        msg = `${formatBalance(amountVal, 5)} ₲ → ${formatBalance(data.exchanged_amount, 2)} ₽`;
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
          formatBalance(userData.user.balance, 5) + " ₲";
        document.getElementById("toBalanceInfo").textContent =
          formatBalance(userData.user.rub_balance, 2) + " ₽";
      } else {
        document.getElementById("balanceInfo").textContent =
          formatBalance(userData.user.rub_balance, 2) + " ₽";
        document.getElementById("toBalanceInfo").textContent =
          formatBalance(userData.user.balance, 5) + " ₲";
      }
    }
  } catch (err) {
    console.error("loadBalanceAndExchangeRate user error:", err);
  }

  try {
    const rateResp = await fetch(`${API_URL}/exchangeRates?limit=50`, {
      credentials: "include",
    });
    const rateData = await rateResp.json();
    if (rateData.success && rateData.rates?.length) {
      currentExchangeRate = parseFloat(rateData.rates[0].exchange_rate);
      // После получения курса сразу рисуем график:
      drawExchangeChart(rateData.rates);
      // И обновляем надпись «1 ₲ = ...»:
      updateCurrentRateDisplay();
    }
  } catch (err) {
    console.error("loadBalanceAndExchangeRate rates error:", err);
  }
}

function updateCurrentRateDisplay() {
  // Убираем обращения к #currentRateDisplay
  // Пишем только в currentRateText (блок над графиком)
  const currentRateText = document.getElementById("currentRateText");
  if (!currentExchangeRate) {
    if (currentRateText) currentRateText.textContent = "--";
    return;
  }
  if (currentRateText) {
    currentRateText.textContent = "" + formatBalance(currentExchangeRate, 2) + " ₽";
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
      String(d.getHours()).padStart(2, "0") + ":" + 
      String(d.getMinutes()).padStart(2, "0")
    );
  });
  const dataPoints = sorted.map((r) => parseFloat(r.exchange_rate));

  // Рассчитываем изменение за период (между первым и последним)
  const firstRate = dataPoints[0];
  const lastRate = dataPoints[dataPoints.length - 1];
  const diff = lastRate - firstRate;
  const percentChange = (diff / firstRate) * 100;
  const rateChangeArrow = document.getElementById("rateChangeArrow");
  const rateChangePercent = document.getElementById("rateChangePercent");
  const rateChangeRub = document.getElementById("rateChangeRub");

  // Обновляем стрелку, цвет и текст
  if (diff > 0) {
    rateChangeArrow.textContent = "↑";
    rateChangeArrow.style.color = "rgb(75, 168, 87)";
    rateChangePercent.textContent = `+${percentChange.toFixed(2)}%`;
    rateChangePercent.style.color = "rgb(75, 168, 87)";
    rateChangeRub.textContent = `+${diff.toFixed(2)}₽`;
  } else if (diff < 0) {
    rateChangeArrow.textContent = "↓";
    rateChangeArrow.style.color = "rgb(210, 27, 27)";
    rateChangePercent.textContent = `${percentChange.toFixed(2)}%`;
    rateChangePercent.style.color = "rgb(210, 27, 27)";
    rateChangeRub.textContent = `${diff.toFixed(2)}₽`;
  } else {
    // diff == 0
    rateChangeArrow.textContent = "→";
    rateChangeArrow.style.color = "#444";
    rateChangePercent.textContent = "+0.00%";
    rateChangePercent.style.color = "#444";
    rateChangeRub.textContent = "+0.00₽";
  }

  // Рисуем график (Chart.js)
  const ctx = document.getElementById("exchangeChart").getContext("2d");
  exchangeChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Курс обмена',
        data: dataPoints,
        fill: false,
        borderColor: 'black',
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

/**************************************************
 * ИСТОРИЯ (без кнопки закрытия, без радиуса)
 **************************************************/
function openHistoryModal(horizontalSwitch) {
  createModal(
    "historyModal",
    `
      <h2 style="text-align:center;">История</h2>
      <div>
        <ul id="transactionList" style="padding:0;list-style:none;margin:0;"></ul>
      </div>
    `,
    {
      showCloseBtn: false, 
      cornerTopMargin: 0,
      cornerTopRadius: 0,
      hasVerticalScroll: true,
      defaultFromBottom: true,
      noRadiusByDefault: true,
      horizontalSwitch: !!horizontalSwitch
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
      const timeStr = new Date(tx.client_time || tx.created_at).toLocaleTimeString("ru-RU");

      let iconSrc = "";
      let titleText = "";
      let detailsText = "";
      let amountSign = "";
      let amountValue = formatBalance(tx.amount, 5);

      // По умолчанию чёрный
      let color = "#000";

      if (tx.type === "merchant_payment") {
        // Оплата по QR
        iconSrc = "92.png";
        titleText = "Оплата по QR";
        detailsText = `Мерчант: ${
          tx.merchant_id ||
          (tx.to_user_id && tx.to_user_id.replace("MERCHANT:", "")) ||
          "???"
        }`;
        amountSign = "-";
        color = "rgb(0 0 0)"; // или красный

      } else if (tx.from_user_id === currentUserId) {
        // Списание (отправили кому-то)
        iconSrc = "67.png";
        titleText = "Отправлено";
        detailsText = `Кому: ${tx.to_user_id}`;
        amountSign = "-";
        color = "rgb(0 0 0)"; // или красный

      } else if (tx.to_user_id === currentUserId) {
        // Пополнение (получили)
        iconSrc = "66.png";
        titleText = "Получено";
        detailsText = `От кого: ${tx.from_user_id}`;
        amountSign = "+";
        color = "rgb(25 150 70)"; // зелёный

      } else if (tx.type === "exchange") {
        // Обмен
        iconSrc = "67.png";
        titleText = "Обмен";
        detailsText = `Направление: ${
          tx.direction === "rub_to_coin" ? "Рубли → Монеты" : "Монеты → Рубли"
        }`;
        if (tx.direction === "rub_to_coin") {
          amountSign = "+";
          color = "rgb(25 150 70)"; // зелёный
        } else {
          amountSign = "-";
          color = "rgb(0 0 0)"; // или красный
        }

      } else {
        // Прочие случаи
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
      iconImg.style.width = "35px";
      iconImg.style.height = "35px";
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
 * МЕРЧАНТ
 **************************************************/
async function openMerchantUI() {
  if (!currentMerchantId) {
    await fetchMerchantInfo();
    if (!currentMerchantId) {
      alert("Ошибка: мерчант не авторизован");
      return;
    }
  }

  // Скрываем/удаляем предыдущий UI, если надо
  hideMainUI();
  removeAllModals();

  // Создаём модальное окно — стилизуем как окно авторизации
  createModal(
    "merchantUIModal",
    `
      <!-- Аналогичная обёртка, как и у окна авторизации -->
      <div style="
        background:#f7f7f7;
        border-radius:20px;
        padding:20px;
        max-width:400px;
        margin:40px auto 0 auto;
        box-shadow:0 2px 5px rgba(0,0,0,0.1);
        display:flex;
        flex-direction:column;
        gap:16px;
        align-items:center;
      ">

        <h2 style="margin:0;">Кабинет мерчанта</h2>
        <p>Мерчант: <strong>${currentMerchantId}</strong></p>
        <p>Баланс: <span id="merchantBalanceValue">0.00000</span> ₲</p>

        <div style="display:flex; gap:10px; margin-top:20px;">
          <button id="merchantCreateQRBtn" 
                  style="padding:10px; border:none; border-radius:8px; cursor:pointer; background:#000; color:#fff;">
            Создать QR
          </button>
          <button id="merchantTransferBtn" 
                  style="padding:10px; border:none; border-radius:8px; cursor:pointer; background:#000; color:#fff;">
            Перевести
          </button>
          <button id="merchantLogoutBtn"
                  style="padding:10px; border:none; border-radius:8px; cursor:pointer; background:#000; color:#fff;">
            Выйти
          </button>
        </div>
      </div>
    `,
    {
      showCloseBtn: false,          // нет креста в углу
      cornerTopMargin: 0,
      cornerTopRadius: 0,
      hasVerticalScroll: true,
      defaultFromBottom: true,
      noRadiusByDefault: true
    }
  );

  // Навешиваем события на кнопки
  document.getElementById("merchantCreateQRBtn").onclick = openOneTimeQRModal;
  document.getElementById("merchantTransferBtn").onclick = openMerchantTransferModal;
  document.getElementById("merchantLogoutBtn").onclick = logout;

  // Загружаем баланс мерчанта
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
    const resp = await fetch(`${API_URL}/merchantBalance?merchantId=${currentMerchantId}`, {
      credentials: "include",
    });
    const data = await resp.json();
    if (data.success) {
      document.getElementById("merchantBalanceValue").textContent = formatBalance(data.balance, 5);
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
      cornerTopRadius: 20,  // хотим радиус
      hasVerticalScroll: true,
      defaultFromBottom: true,
      noRadiusByDefault: false
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
  if (!currentExchangeRate || isNaN(currentExchangeRate)) {
    document.getElementById("qrRubEquivalent").textContent = "Курс не доступен";
    return;
  }
  const rubVal = coinVal * currentExchangeRate;
  document.getElementById("qrRubEquivalent").textContent =
    "≈ " + formatBalance(rubVal, 2) + " RUB";
}

function createMerchantQR(amount, purpose) {
  const qrData = `guga://merchantId=${currentMerchantId}&amount=${amount}&purpose=${encodeURIComponent(
    purpose
  )}`;

  // Аналогично стилизуем окно
  createModal(
    "merchantQRModal",
    `
      <!-- Обёртка, чтобы было похоже на auth-стиль -->
      <div style="
        background:#f7f7f7;
        border-radius:20px;
        padding:20px;
        max-width:400px;
        margin:0 auto;
        box-shadow:0 2px 5px rgba(0,0,0,0.1);
        display:flex;
        flex-direction:column;
        margin-top:50px;
        align-items:center;
      ">

        <!-- Контейнер для самого QR -->
        <div id="merchantQRModalContainer"
             style="display:flex; justify-content:center; margin-bottom:10px;">
        </div>

        <!-- Сумма и Назначение -->
        <p style="margin-top:10px;">
          Запрашиваемая сумма: <strong>${formatBalance(amount, 5)} ₲</strong>
        </p>
        <p style="margin:0;">
          Назначение: <strong>${purpose}</strong>
        </p>
      </div>
    `,
    {
      showCloseBtn: true,
      cornerTopMargin: 50,
      cornerTopRadius: 20,
      hasVerticalScroll: true,
      defaultFromBottom: true,
      noRadiusByDefault: false
    }
  );

  // Генерируем QR (350×350)
  if (typeof QRCode === "function") {
    const container = document.getElementById("merchantQRModalContainer");
    if (container) {
      const qrElem = document.createElement("div");
      container.appendChild(qrElem);

      new QRCode(qrElem, {
        text: qrData,
        width: 350,
        height: 350,
      });
    }
  } else {
    // Если вдруг нет QRCode()
    const cont = document.getElementById("merchantQRModalContainer");
    if (cont) {
      cont.textContent = "QR data: " + qrData;
    }
  }

  // Запускаем мониторинг оплаты
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
      cornerTopRadius: 20, // радиус
      hasVerticalScroll: true,
      defaultFromBottom: true,
      noRadiusByDefault: false
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
 * ПАРСИНГ QR + ЗАПРОС КАМЕРЫ (И ДЕКОДИРОВАНИЕ)
 **************************************************/
function startUniversalQRScanner(videoElement, onResultCallback) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Камера не поддерживается вашим браузером");
    return;
  }

  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: "environment" } })
    .then((stream) => {
      videoElement.srcObject = stream;
      videoElement.setAttribute("playsinline", true); // нужно для iOS
      videoElement.play();

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      let alreadyScanned = false; // флаг, чтобы не обрабатывать повторно

      function tick() {
        if (!alreadyScanned && videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
          canvas.width = videoElement.videoWidth;
          canvas.height = videoElement.videoHeight;
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, canvas.width, canvas.height);

          if (code) {
            // Успешно распознали QR
            alreadyScanned = true;      // ставим флаг
            stopStream(stream);         // останавливаем камеру
            onResultCallback(code.data); // вызываем колбэк
            return;
          }
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    })
    .catch((err) => {
      alert("Доступ к камере отклонён: " + err);
    });
}

function stopStream(stream) {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
}

function parseMerchantQRData(qrString) {
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

/**************************************************
 * УВЕДОМЛЕНИЯ (TOASTS)
 **************************************************/
const notificationStyle = document.createElement("style");
notificationStyle.textContent = `
  #notificationContainer {
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 9999999;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-end;
  }

  .notification {
    background: #fff;
    color: #333;
    border: 1px solid #ddd;
    padding: 10px 14px;
    border-radius: 4px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    position: relative;
    min-width: 200px;
    max-width: 300px;
    word-break: break-word;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: sans-serif;
    font-size: 14px;
  }

  .notification-success {
    border-color: #c3e6cb;
    background-color: #d4edda;
    color: #155724;
  }

  .notification-error {
    border-color: #f5c6cb;
    background-color: #f8d7da;
    color: #721c24;
  }

  .notification-info {
    border-color: #bee5eb;
    background-color: #d1ecf1;
    color: #0c5460;
  }

  .notification-close {
    background: none;
    border: none;
    color: currentColor;
    font-size: 18px;
    cursor: pointer;
    margin-left: 10px;
  }
`;
document.head.appendChild(notificationStyle);

// Контейнер для всех уведомлений
const notificationContainer = document.createElement("div");
notificationContainer.id = "notificationContainer";
document.body.appendChild(notificationContainer);

/**
 * Функция для показа уведомления.
 * @param {string} message Текст уведомления.
 * @param {'success'|'error'|'info'} [type='info'] Тип уведомления (цвет).
 * @param {number} [duration=5000] Время автозакрытия (мс). Если 0 — не закрывать автоматически.
 */
function showNotification(message, type = "info", duration = 5000) {
  const notif = document.createElement("div");
  notif.classList.add("notification");
  if (type === "success") {
    notif.classList.add("notification-success");
  } else if (type === "error") {
    notif.classList.add("notification-error");
  } else {
    notif.classList.add("notification-info");
  }

  // Текст
  const textEl = document.createElement("div");
  textEl.style.flex = "1";
  textEl.textContent = message;

  // Кнопка "закрыть"
  const closeBtn = document.createElement("button");
  closeBtn.className = "notification-close";
  closeBtn.innerHTML = "&times;";
  closeBtn.addEventListener("click", () => {
    if (notif.parentNode === notificationContainer) {
      notificationContainer.removeChild(notif);
    }
  });

  notif.appendChild(textEl);
  notif.appendChild(closeBtn);
  notificationContainer.appendChild(notif);

  // Автоудаление
  if (duration && duration > 0) {
    setTimeout(() => {
      if (notif.parentNode === notificationContainer) {
        notificationContainer.removeChild(notif);
      }
    }, duration);
  }
}

window.addEventListener("beforeunload", () => {
  if (pendingMinedCoins > 0) {
    flushMinedCoins();
  }
});

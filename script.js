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

// В начало файла добавить базовые стил
const appStyle = document.createElement('style');
appStyle.textContent = `
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    font-family: Arial, sans-serif;
  }

  #appContainer {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .scrollable-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    padding-bottom: 80px;
  }
`;
document.head.appendChild(appStyle);

/**************************************************
 * УТИЛИТЫ
 **************************************************/

/**
 * Форматирование чисел с заданным количеством знаков после запятой.
 * @param {number|string} num Число для форматирования.
 * @param {number} decimals Количество знаков после запятой.
 * @param {string} defaultValue Значение по умолчанию, если ввод некорректен.
 * @returns {string} Отформатированное число.
 */
function formatBalance(num, decimals = 5, defaultValue = "0.00000") {
    const parsed = parseFloat(num);
    return isNaN(parsed) ? defaultValue : parsed.toFixed(decimals);
}

/**
 * Показывает глобальный индикатор загрузки.
 */
function showGlobalLoading() {
    if (!loadingIndicator) {
        console.warn("Loading indicator element not found.");
        return;
    }
    loadingIndicator.style.display = "flex";
}

/**
 * Скрывает глобальный индикатор загрузки.
 */
function hideGlobalLoading() {
    if (!loadingIndicator) {
        console.warn("Loading indicator element not found.");
        return;
    }
    loadingIndicator.style.display = "none";
}

// Кэширование элемента индикатора загрузки.
const loadingIndicator = document.getElementById("loadingIndicator");

/**************************************************
 * ПОДКЛЮЧЕНИЕ СТИЛЕЙ
 **************************************************/
function loadCSSStylesheet() {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "styles.css"; // Убедитесь, что путь корректный
    document.head.appendChild(link);
}

// Загружаем стили при загрузке страницы
loadCSSStylesheet();

/**************************************************
 * УНИВЕРСАЛЬНАЯ РАБОТА С МОДАЛКАМИ
 **************************************************/

/**
 * Создает модальное окно.
 * @param {string} id Уникальный идентификатор модального окна.
 * @param {string} content HTML-содержимое модального окна.
 * @param {Object} options Настройки модального окна.
 * @param {boolean} [options.showCloseBtn=true] Показать кнопку закрытия.
 * @param {boolean} [options.hasVerticalScroll=true] Включить вертикальную прокрутку.
 * @param {boolean} [options.defaultFromBottom=true] Анимация появления снизу.
 * @param {number} [options.cornerTopMargin=0] Отступ сверху в пикселях.
 * @param {number} [options.cornerTopRadius=0] Радиус углов.
 * @param {boolean} [options.noRadiusByDefault=false] Убрать радиус по умолчанию.
 * @param {Function} [options.onClose] Колбэк при закрытии окна.
 */
function createModal(
    id,
    content,
    {
        showCloseBtn = true,
        hasVerticalScroll = true,
        defaultFromBottom = true,
        cornerTopMargin = 0,
        cornerTopRadius = 0,
        noRadiusByDefault = false,
        onClose = null,
    } = {}
) {
    // Удаляем старое модальное окно с таким ID, если существует
    const existingModal = document.getElementById(id);
    if (existingModal) {
        existingModal.remove();
    }

    // Создаем основную структуру модального окна
    const modal = document.createElement("div");
    modal.id = id;
    modal.className = "modal";
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.display = "flex";
    modal.style.justifyContent = "center";
    modal.style.alignItems = "center";
    modal.style.background = "rgba(0,0,0,0.5)";
    modal.style.zIndex = "100000";

    // Создаем контейнер для содержимого
    const contentDiv = document.createElement("div");
    contentDiv.className = "modal-content";
    
    contentDiv.style.width = "100%";
    contentDiv.style.maxWidth = "500px";
    contentDiv.style.marginTop = `${cornerTopMargin}px`;
    contentDiv.style.height = `calc(100% - ${cornerTopMargin}px)`;
    contentDiv.style.overflowY = hasVerticalScroll ? "auto" : "hidden";
    contentDiv.style.borderRadius = noRadiusByDefault
        ? "0"
        : `${cornerTopRadius}px ${cornerTopRadius}px 0 0`;
    contentDiv.style.background = "#fff";
    contentDiv.style.boxShadow = "0 2px 5px rgba(0,0,0,0.1)";
    contentDiv.style.padding = "20px";

    // Добавляем содержимое
    contentDiv.innerHTML = `
        ${showCloseBtn ? '<button class="modal-close-btn">&times;</button>' : ""}
        ${content}
    `;

    // Стилизация кнопки закрытия
const closeBtn = contentDiv.querySelector(".modal-close-btn");
if (closeBtn) {
    Object.assign(closeBtn.style, {
    position: "absolute",
    top: "15px", // Отступ сверху
    right: "20px", // Отступ справа
    width: "30px", // Ширина кнопки
    height: "30px", // Высота кнопки
    backgroundColor: "#000", // Чёрный фон
    color: "#fff", // Белый крестик
    borderRadius: "50%", // Делаем кнопку круглой
    border: "none", // Убираем границы
    display: "flex", // Используем flex для выравнивания
    alignItems: "center", // Центрируем крестик по вертикали
    justifyContent: "center", // Центрируем крестик по горизонтали
    cursor: "pointer", // Курсор "рука" при наведении
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)", // Тень для объёмности
    transition: "all 0.3s ease", // Плавный переход
    zIndex: "1001", // Поверх остальных элементов
});

// Добавляем hover-эффект
closeBtn.addEventListener("mouseenter", () => {
    closeBtn.style.backgroundColor = "#333"; // Темнее при наведении
    closeBtn.style.transform = "scale(1.1)"; // Увеличиваем чуть-чуть
});
closeBtn.addEventListener("mouseleave", () => {
    closeBtn.style.backgroundColor = "#000"; // Возвращаем фон
    closeBtn.style.transform = "scale(1)"; // Возвращаем размер
});
}
    modal.appendChild(contentDiv);
    document.body.appendChild(modal);

    // Добавляем обработчик закрытия окна
    if (showCloseBtn) {
        const closeBtn = contentDiv.querySelector(".modal-close-btn");
        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                modal.remove();
                if (onClose) onClose();
            });
        }
    }

    // Закрытие по клику на фон (если требуется)
    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            modal.remove();
            if (onClose) onClose();
        }
    });
}

/**
 * Удаляет все модальные окна.
 */
function removeAllModals() {
    document.querySelectorAll(".modal").forEach((modal) => modal.remove());
}

/**************************************************
 * АВТОРИЗАЦИЯ И РЕГИСТРАЦИЯ
 **************************************************/

/**
 * Универсальная функция для API-запросов (авторизация, регистрация и т.д.).
 * @param {string} endpoint Конечная точка API.
 * @param {Object} payload Тело запроса.
 * @returns {Promise<Object>} Ответ сервера.
 */
async function apiAuthRequest(endpoint, payload) {
    try {
        showGlobalLoading();
        const response = await fetch(`${API_URL}/${endpoint}`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || "Неизвестная ошибка");
        }

        return data;
    } catch (err) {
        console.error(`Ошибка в запросе к ${endpoint}:`, err);
        showNotification(err.message, "error");
        throw err;
    } finally {
        hideGlobalLoading();
    }
}

/**
 * Обработчик входа пользователя.
 */
async function login() {
    const loginVal = document.getElementById("loginInput")?.value.trim();
    const passVal = document.getElementById("passwordInput")?.value.trim();

    if (!validateInput(loginVal, 1) || !validateInput(passVal, 6)) {
        showNotification("Введите корректный логин (мин. 1 символ) и пароль (мин. 6 символов)", "error");
        return;
    }

    try {
        // Попытка авторизации как пользователь
        const userData = await apiAuthRequest("login", { username: loginVal, password: passVal });
        await fetchUserData();
        closeAllAuthModals();
        createMainUI();
        updateUI();
    } catch {
        try {
            // Попытка авторизации как мерчант
            const merchantData = await apiAuthRequest("merchantLogin", { username: loginVal, password: passVal });
            await fetchMerchantData();
            closeAllAuthModals();
            openMerchantUI();
        } catch (err) {
            showNotification("Ошибка авторизации: " + err.message, "error");
        }
    }
}

/**
 * Обработчик регистрации пользователя.
 */
async function register() {
    const loginVal = document.getElementById("regLogin")?.value.trim();
    const passVal = document.getElementById("regPassword")?.value.trim();

    if (!validateInput(loginVal, 1) || !validateInput(passVal, 6)) {
        showNotification("Введите корректный логин (мин. 1 символ) и пароль (мин. 6 символов)", "error");
        return;
    }

    try {
        const data = await apiAuthRequest("register", { username: loginVal, password: passVal });
        showNotification(`Аккаунт успешно создан! Ваш userId: ${data.userId}`, "success");
        await login(); // Автоматический вход после регистрации
    } catch (err) {
        showNotification("Ошибка регистрации: " + err.message, "error");
    }
}

/**
 * Обработчик выхода из системы.
 */
async function logout() {
    try {
        await fetch(`${API_URL}/logout`, {
            method: "POST",
            credentials: "include",
        });
        showNotification("Вы вышли из системы", "success");
    } catch (err) {
        console.error("Ошибка при выходе:", err);
        showNotification("Ошибка при выходе", "error");
    } finally {
        currentUserId = null;
        currentMerchantId = null;
        removeAllModals();
        hideMainUI();
        openAuthModal();
    }
}

/**
 * Валидация пользовательского ввода.
 * @param {string} value Входное значение.
 * @param {number} minLength Минимальная длина значения.
 * @returns {boolean} Результат проверки.
 */
function validateInput(value, minLength = 1) {
    return value && value.length >= minLength;
}

/**************************************************
 * ОКНО ЗАПРОСА QR (единый стиль интерфейса)
 **************************************************/
function openRequestModal() {
  createModal(
    "requestModal",
    `
      <div style="
        max-width: 400px;
        margin: 0 auto;
        padding: 24px;
        background: #FFFFFF;
        border-radius: 24px;
        box-shadow: 0px 4px 20px rgba(0, 0, 0, 0.1);
        position: relative;
        margin-top: 40px;
      ">
        <div style="
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 32px;
        ">
          <img src="photo/15.png" style="width: 40px; height: 40px;">
          <div>
            <div style="font-size: 20px; font-weight: 600; color: #1A1A1A;">GUGA</div>
            <div style="font-size: 16px; color: #666;">Запрос на перевод</div>
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            color: #666;
            font-size: 14px;
          ">
            <span>Сумма перевода</span>
          </div>
          
          <div style="
            background: #F8F9FB;
            border-radius: 16px;
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 10px;
            border: 1px solid #E6E6EB;
          ">
            <input 
              type="number" 
              id="requestAmountInput" 
              placeholder="0.00"
              style="
                flex: 1;
                background: none;
                border: none;
                color: #1A1A1A;
                font-size: 18px;
                outline: none;
                padding: 0;
                font-weight: 500;
              ">
            <span style="color: #666; font-size: 16px;">₲</span>
          </div>
        </div>

        <button 
          id="generateQRBtn" 
          style="
            width: 100%;
            padding: 16px;
            background: #1A1A1A;
            border: none;
            border-radius: 12px;
            color: white;
            font-weight: 600;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.2s;
            margin-top: 8px;
            background: linear-gradient(90deg, #2F80ED, #2D9CDB);
          ">
          Создать QR-код
        </button>
      </div>
    `,
    {
      showCloseBtn: true,
      cornerTopMargin: 0,
      cornerTopRadius: 0,
      hasVerticalScroll: true,
      defaultFromBottom: true,
      noRadiusByDefault: false,
      contentMaxHeight: "calc(100vh - 160px)", // Отступ для нижней панели
    }
  );

  document.getElementById("generateQRBtn").addEventListener("click", () => {
    const amount = parseFloat(document.getElementById("requestAmountInput").value);

    if (!amount || amount <= 0) {
      showNotification("Введите корректную сумму!", "error");
      return;
    }

    if (!currentUserId) {
      showNotification("Требуется авторизация", "error");
      return;
    }

    const qrData = `guga://type=person&userId=${currentUserId}&amount=${amount}`;

    createModal(
      "qrModal",
      `
        <div style="
          max-width: 400px;
          margin: 0 auto;
          padding: 24px;
          background: #FFFFFF;
          border-radius: 24px;
          text-align: center;
        ">
          <div style="
            display: flex;
            align-items: center;
            gap: 12px;
            justify-content: center;
            margin-bottom: 24px;
          ">
            <img src="photo/15.png" style="width: 40px; height: 40px;">
            <div style="font-size: 20px; font-weight: 600;">GUGA</div>
          </div>
          
          <div id="qrCodeContainer" style="
            background: white;
            padding: 16px;
            border-radius: 16px;
            margin: 0 auto 20px;
            width: fit-content;
            box-shadow: 0px 4px 15px rgba(0, 0, 0, 0.1);
          "></div>
          
          <div style="
            font-size: 18px;
            color: #1A1A1A;
            font-weight: 500;
            margin-bottom: 8px;
          ">
            ${formatBalance(amount, 5)} ₲
          </div>
          
          <div style="color: #666; font-size: 14px;">
            Отсканируйте QR-код для перевода
          </div>
        </div>
      `,
      {
        showCloseBtn: true,
        cornerTopMargin: 20,
        cornerTopRadius: 24,
        hasVerticalScroll: true,
        defaultFromBottom: true,
        noRadiusByDefault: false,
        contentMaxHeight: "calc(100vh - 160px)", // Отступ снизу
      }
    );

    new QRCode(document.getElementById("qrCodeContainer"), {
      text: qrData,
      width: 200,
      height: 200,
      colorDark: "#1A1A1A",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
  });
}

/**************************************************
 * Новая функция генерации QR-кода
 **************************************************/

function createUserQR(userId, amount, purpose) {
  if (!userId) {
    console.error("Ошибка: userId отсутствует.");
    return null;
  }

  const qrData = `guga://type=person&userId=${userId}&amount=${amount}&purpose=${encodeURIComponent(purpose)}`;
  console.log("Сгенерирован QR-код:", qrData);

  // Дополнительно: показать QR-код пользователю
  createModal(
    "qrModal",
    `
      <h3>Ваш QR-код</h3>
      <div id="qrCodeContainer" style="display: flex; justify-content: center; align-items: center; margin: 20px 0;"></div>
      <p>Сумма: <strong>${amount.toFixed(2)}</strong></p>
      ${purpose ? `<p>Назначение: <strong>${purpose}</strong></p>` : ""}
    `,
    {
      showCloseBtn: true,
      cornerTopMargin: 50,
      cornerTopRadius: 20,
      hasVerticalScroll: true,
      defaultFromBottom: true,
      noRadiusByDefault: false,
    }
  );

  const qrCodeContainer = document.getElementById("qrCodeContainer");
  new QRCode(qrCodeContainer, {
    text: qrData,
    width: 300,
    height: 300,
  });

  return qrData;
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

        <!-- Вход -->
        <div id="loginSection" style="display:flex; flex-direction:column; gap:8px;">
          <input type="text" id="loginInput" placeholder="Логин">
          <input type="password" id="passwordInput" placeholder="Пароль">
          <button id="loginSubmitBtn">Войти</button>
        </div>

        <!-- Регистрация -->
        <div id="registerSection" style="display:none; flex-direction:column; gap:8px;">
          <input type="text" id="regLogin" placeholder="Логин">
          <input type="password" id="regPassword" placeholder="Пароль">
          <button id="registerSubmitBtn">Зарегистрироваться</button>
        </div>

        <!-- Переключатель -->
        <button id="toggleAuthBtn">Войти / Зарегистрироваться</button>

        <!-- Кнопка Telegram -->
        <div id="telegramBtnContainer" style="margin-top:15px;">
          <div style="text-align:center; color:#666; margin-bottom:8px;">Или</div>
        </div>
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

  // Обработчики стандартной авторизации
  document.getElementById("loginSubmitBtn").addEventListener("click", login);
  document.getElementById("registerSubmitBtn").addEventListener("click", register);
  document.getElementById("toggleAuthBtn").addEventListener("click", toggleAuthForms);

  // Добавляем кнопку Telegram
  if (window.Telegram?.WebApp) {
    const telegramBtn = document.createElement("button");
    telegramBtn.innerHTML = `
      <img src="https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg" 
           style="height:20px; margin-right:10px;">
      Войти через Telegram
    `;

    // Стилизация кнопки
    Object.assign(telegramBtn.style, {
      width: "100%",
      padding: "12px",
      backgroundColor: "#0088cc",
      color: "white",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    });

    // Обработчик авторизации через Telegram
    telegramBtn.addEventListener("click", async () => {
      try {
        showGlobalLoading();
        
        // 1. Получаем данные пользователя
        Telegram.WebApp.ready();
        const tgUser = Telegram.WebApp.initDataUnsafe?.user;
        
        if (!tgUser?.id) {
          throw new Error("Не удалось получить данные Telegram");
        }

        // 2. Отправляем запрос на сервер
        const response = await fetch(`${API_URL}/auth/telegram`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            telegramId: tgUser.id,
            firstName: tgUser.first_name,
            username: tgUser.username,
            photoUrl: tgUser.photo_url
          })
        });

        // 3. Обрабатываем ответ
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Ошибка сервера");
        }

        // 4. Закрываем модалку и обновляем интерфейс
        document.getElementById("authModal")?.remove();
        await fetchUserData();
        createMainUI();
        updateUI();

      } catch (err) {
        console.error("Ошибка авторизации через Telegram:", err);
        alert(err.message);
      } finally {
        hideGlobalLoading();
      }
    });

    document.getElementById("telegramBtnContainer").appendChild(telegramBtn);
  }

  // Вспомогательные функции
  function toggleAuthForms() {
    const loginSection = document.getElementById("loginSection");
    const registerSection = document.getElementById("registerSection");
    loginSection.style.display = loginSection.style.display === "none" ? "flex" : "none";
    registerSection.style.display = registerSection.style.display === "none" ? "flex" : "none";
  }
}

/**************************************************
 * ГЛАВНЫЙ ЭКРАН (единый стиль с градиентом, 
 * закруглённым верхом и крупными балансами)
 **************************************************/
function createMainUI() {
  // 1) Создаём/подключаем общий CSS для стилей
  injectMainUIStyles();

  // 2) Вместо profileIcon (справа) — создаём user-info (слева)
  if (!document.getElementById("user-info")) {
    const userInfoContainer = document.createElement("div");
    userInfoContainer.id = "user-info";
    userInfoContainer.className = "user-info";
    // При клике на этот блок - открываем профиль
    userInfoContainer.addEventListener("click", openProfileModal);

    // Фото
    const userPhoto = document.createElement("img");
    userPhoto.id = "user-photo";
    userPhoto.className = "user-photo";
    userPhoto.src = ""; // по умолчанию пусто, обновится при fetchUserData()
    userPhoto.alt = "User Photo";

    // Имя
    const userNameSpan = document.createElement("span");
    userNameSpan.id = "user-name";
    userNameSpan.className = "user-name";
    userNameSpan.textContent = ""; // или "User Name", если нужно по умолчанию

    userInfoContainer.appendChild(userPhoto);
    userInfoContainer.appendChild(userNameSpan);

    document.body.appendChild(userInfoContainer);
  }

  // 3) Контейнер "main-header" с градиентным фоном и закруглённым низом
  let headerEl = document.getElementById("mainHeaderContainer");
  if (!headerEl) {
    headerEl = document.createElement("div");
    headerEl.id = "mainHeaderContainer";
    headerEl.className = "main-header";
    document.body.appendChild(headerEl);

    // Кнопки "Перевести", "Запросить", "Оплатить"
    const actionContainer = document.createElement("div");
    actionContainer.className = "action-container";
    actionContainer.innerHTML = `
      <button id="transferBtn" class="action-btn">
        <div class="icon-wrap">
          <img src="photo/81.png" class="action-icon"/>
        </div>
        <span>Перевести</span>
      </button>
      <button id="requestBtn" class="action-btn">
        <div class="icon-wrap">
          <img src="photo/82.png" class="action-icon"/>
        </div>
        <span>Запросить</span>
      </button>
      <button id="payQRBtn" class="action-btn">
        <div class="icon-wrap">
          <img src="photo/90.png" class="action-icon"/>
        </div>
        <span>Оплатить</span>
      </button>
    `;
    headerEl.appendChild(actionContainer);

    // Обработчики
    actionContainer.querySelector("#transferBtn").addEventListener("click", () => {
      removeAllModals();
      openTransferModal();
    });
    actionContainer.querySelector("#requestBtn").addEventListener("click", () => {
      removeAllModals();
      openRequestModal();
    });
    actionContainer.querySelector("#payQRBtn").addEventListener("click", () => {
      removeAllModals();
      openPayQRModal();
    });

    // Разделитель (опционально)
    const headerDivider = document.createElement("div");
    headerDivider.className = "header-divider";
    headerEl.appendChild(headerDivider);
  }

  // 4) Контейнер "balanceContainer" — крупные карточки для баланса
  let balanceContainer = document.getElementById("balanceContainer");
  if (!balanceContainer) {
    balanceContainer = document.createElement("div");
    balanceContainer.id = "balanceContainer";
    balanceContainer.className = "balance-container";
    document.body.appendChild(balanceContainer);

    // Карточка RUB
    const rubCard = document.createElement("div");
    rubCard.className = "balance-card rub";
    rubCard.innerHTML = `
      <div class="balance-icon-wrap">
        <img src="photo/18.png" alt="RUB" class="balance-icon">
      </div>
      <div class="balance-info">
        <div class="balance-label">RUB</div>
        <div id="rubBalanceValue" class="balance-amount">0.00 ₽</div>
      </div>
    `;
    balanceContainer.appendChild(rubCard);

    // Карточка GUGA
    const gugaCard = document.createElement("div");
    gugaCard.className = "balance-card guga";
    gugaCard.innerHTML = `
      <div class="balance-icon-wrap">
        <img src="photo/15.png" alt="GUGA" class="balance-icon">
      </div>
      <div class="balance-info">
        <div class="balance-label">
          GUGA 
        </div>
        <div id="gugaBalanceValue" class="balance-amount">0.00000 ₲</div>
      </div>
    `;
    balanceContainer.appendChild(gugaCard);
  }

  // 5) Нижняя панель (bottomBar) — «Главная», «История», «Обменять»
  if (!document.getElementById("bottomBar")) {
    const bottomBar = document.createElement("div");
    bottomBar.id = "bottomBar";
    bottomBar.className = "bottom-bar";
    bottomBar.innerHTML = `
      <button id="btnMain" class="nav-btn">
        <img src="photo/69.png" class="nav-icon">
        <span>Главная</span>
      </button>
      <button id="historyBtn" class="nav-btn">
        <img src="photo/70.png" class="nav-icon">
        <span>История</span>
      </button>
      <button id="exchangeBtn" class="nav-btn">
        <img src="photo/71.png" class="nav-icon">
        <span>Обменять</span>
      </button>
    `;
    document.body.appendChild(bottomBar);

    bottomBar.querySelector("#btnMain").addEventListener("click", () => {
      removeAllModals();
    });
    bottomBar.querySelector("#historyBtn").addEventListener("click", () => {
      removeAllModals();
      openHistoryModal();
    });
    bottomBar.querySelector("#exchangeBtn").addEventListener("click", () => {
      removeAllModals();
      openExchangeModal();
    });
  }

  // 6) Показываем balanceDisplay, если он есть
  const balanceDisplay = document.getElementById("balanceDisplay");
  if (balanceDisplay) {
    balanceDisplay.style.display = "block"; 
  }

  // Скрываем майнинг, если есть
  const mineContainer = document.getElementById("mineContainer");
  if (mineContainer) {
    mineContainer.style.display = "none";
  }

  // 7) Запрашиваем данные (балансы, user info) и запускаем автоповтор
  fetchUserData();
  clearInterval(updateInterval);
  updateInterval = setInterval(fetchUserData, 2000);
}

/**************************************************
 * Подключаем общий стиль для главного экрана
 **************************************************/
function injectMainUIStyles() {
  if (document.getElementById("mainUIStyles")) return; // чтобы не дублировать

  const style = document.createElement("style");
  style.id = "mainUIStyles";
  style.textContent = `
    body {
      margin: 0;
      padding: 0;
      font-family: "Oswald", sans-serif;
    }

    /* Блок user-info (левый верхний угол) */
    .user-info {
      position: absolute;
      top: 10px;
      left: 10px;
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fff;
      border-radius: 8px;
      padding: 6px 10px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      cursor: pointer; /* чтобы показывать, что кликабельно */
    }
    .user-photo {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
      background: #eee;
    }
    .user-name {
      font-size: 14px;
      font-weight: 600;
      color: #333;
      max-width: 130px;  /* чтобы если имя длинное, переносилось */
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Верхняя часть с градиентом */
    .main-header {
      width: 100%;
      background: linear-gradient(90deg, #2F80ED, #2D9CDB);
      border-bottom-left-radius: 20px;
      border-bottom-right-radius: 20px;
      padding: 16px;
      box-sizing: border-box;
      z-index: 90000;
    }
    .action-container {
      display: flex;
      gap: 16px;
      justify-content: center;
      margin-bottom: 16px;
      margin-top: 175px; /* Чтобы опустить кнопки вниз */
    }
    .action-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      border: none;
      background: none;
      cursor: pointer;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .action-btn:hover {
      opacity: 0.9;
    }

    /* Контейнер для иконки-картинки (белый фон, закруглённые углы, центрирование) */
    .icon-wrap {
      width: 50px;              
      height: 50px;
      background: #fff;         
      border-radius: 12px;      
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 10px;       
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    }

    .action-icon {
      width: 28px;              
      height: 28px;
      border-radius: 6px;       
      object-fit: cover;        
    }

    .header-divider {
      width: 100%;
      height: 0px;
    }

    /* Контейнер для балансов */
    .balance-container {
      position: absolute;
      top: 320px;
      width: 90%;
      max-width: 500px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .balance-card {
      background: #F8F9FB;
      border-radius: 15px;
      padding: 10px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      display: flex;
      align-items: center;
      gap: 16px;
      margin-left: -5px;
      margin-right: -5px;
    }
    .balance-icon-wrap {
      width: 50px;
      height: 50px;
      background: #F0F0F0;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .balance-icon {
      width: 30px; 
      height: 30px;
    }
    .balance-info {
      display: flex;
      flex-direction: column;
    }
    .balance-label {
      font-size: 15px;
      font-weight: 500;
      color: #1A1A1A;
    }
    .balance-amount {
      font-size: 16px;
      font-weight: 500;
      color: #666;
    }

    /* Нижняя панель */
    .bottom-bar {
      position: fixed;
      bottom: 0; left: 0;
      width: 100%;
      background-color: #fff;
      display: flex;
      justify-content: space-around;
      align-items: center;
      padding-bottom: 20px;
      box-shadow: 0 -2px 5px rgba(0,0,0,0.1);
      z-index: 999999;
    }
    .nav-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      border: none;
      background: none;
      cursor: pointer;
      color: #000;
      font-size: 14px;
      padding: 10px;
    }
    .nav-icon {
      width: 30px;
      height: 30px;
      margin-bottom: 4px;
    }
  `;
  document.head.appendChild(style);
}

/**************************************************
 * ПОЛЬЗОВАТЕЛЬ
 **************************************************/
async function fetchUserData() {
  try {
    // Получаем данные параллельно
    const [userResp, ratesResp] = await Promise.all([
      fetch(`${API_URL}/user`, { credentials: "include" }),
      fetch(`${API_URL}/exchangeRates?limit=1`)
    ]);

    const userData = await userResp.json();
    const ratesData = await ratesResp.json();

    if (userData.success && userData.user) {
      currentUserId = userData.user.user_id;
      const coinBalance = userData.user.balance || 0;
      const rubBalance = userData.user.rub_balance || 0;
      const currentRate = ratesData.success && ratesData.rates.length 
        ? parseFloat(ratesData.rates[0].exchange_rate) 
        : 0;

      // Получаем URL фото и имя пользователя
      const photoUrl = userData.user.photo_url || ""; // URL фото
      const firstName = userData.user.first_name || "Гость"; // Имя пользователя

      // Обновляем фото и имя в интерфейсе
      const userInfoContainer = document.getElementById("user-info");
      if (userInfoContainer) {
        // Если контейнер существует, обновляем его содержимое
        const userPhoto = userInfoContainer.querySelector(".user-photo");
        const userName = userInfoContainer.querySelector(".user-name");

        if (userPhoto) {
          userPhoto.src = photoUrl;
        }
        if (userName) {
          userName.textContent = firstName;
        }
      } else {
        // Если контейнер не существует, создаём его
        const newUserInfoContainer = document.createElement("div");
        newUserInfoContainer.id = "user-info";
        newUserInfoContainer.classList.add("user-info");

        const userPhoto = document.createElement("img");
        userPhoto.classList.add("user-photo");
        userPhoto.src = photoUrl;
        userPhoto.alt = "User Photo";

        const userName = document.createElement("span");
        userName.classList.add("user-name");
        userName.textContent = firstName;

        newUserInfoContainer.appendChild(userPhoto);
        newUserInfoContainer.appendChild(userName);

        // Добавляем контейнер в DOM (например, в body или в header)
        document.body.appendChild(newUserInfoContainer);
      }

      // Старое отображение (оставляем для совместимости)
      const balanceValue = document.getElementById("balanceValue");
      if (balanceValue) {
        // Новое значение: общий баланс в рублях
        const totalRub = rubBalance + (coinBalance * currentRate);
        balanceValue.textContent = `${formatBalance(totalRub, 2)} ₽`;
      }

      const userIdEl = document.getElementById("userIdDisplay");
      if (userIdEl) {
        userIdEl.textContent = "ID: " + currentUserId;
      }

      // Обновляем RUB баланс (старая логика)
      const rubBalanceInfo = document.getElementById("rubBalanceValue");
      if (rubBalanceInfo) {
        rubBalanceInfo.textContent = `${formatBalance(rubBalance, 2)} ₽`;
      }

      // Новые элементы для детализации
      const gugaBalanceElement = document.getElementById("gugaBalanceValue");
      if (gugaBalanceElement) {
        gugaBalanceElement.textContent = `${formatBalance(coinBalance, 5)} ₲`;
      }

      const convertedBalanceElement = document.getElementById("convertedBalance");
      if (convertedBalanceElement) {
        convertedBalanceElement.textContent = `${formatBalance(coinBalance * currentRate, 2)} ₽`;
      }

      const rateDisplayElement = document.getElementById("currentRateDisplay");
      if (rateDisplayElement) {
        rateDisplayElement.textContent = formatBalance(currentRate, 2);
      }
    }
  } catch (err) {
    console.error("fetchUserData error:", err);
    // Показываем ошибку в интерфейсе
    const balanceValue = document.getElementById("balanceValue");
    if (balanceValue) {
      balanceValue.textContent = "-- ₽";
    }
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
function openProfileModal() {
  createModal(
    "profileModal",
    `
      <h3 style="text-align:center;">Профиль</h3>
      <button id="profileLogoutBtn" style="padding:10px;margin-top:20px;">Выйти из аккаунта</button>
    `,
    {
      showCloseBtn: true,
      cornerTopMargin: 0,
      cornerTopRadius: 0,
      hasVerticalScroll: true,
      profileFromTop: true,
      defaultFromBottom: false,
      noRadiusByDefault: true
    }
  );
  document.getElementById("profileLogoutBtn").onclick = logout;
}

/**************************************************
 * ПЕРЕВОД
 **************************************************/
function openTransferModal() {
  createModal(
    "transferModal",
    `
<div class="transfer-container">
    <div class="transfer-header">
        <div class="header-info">
            <div class="transfer-title">Перевод средств</div>
        </div>
    </div>

    <!-- Блок выбора валюты -->
    <div class="currency-select">
        <div id="btnCurrencyGUGA" class="currency-card">
            <div style="display: flex; align-items: center; gap: 12px;">
                <img src="photo/15.png" style="width: 32px; height: 32px; border-radius: 8px;">
                <div>
                    <div style="font-weight: 500; color: #1A1A1A;">GUGA</div>
                    <div style="font-size: 13px; color: #909099;">Криптовалюта</div>
                </div>
            </div>
            <div id="gugaBalance" style="margin-top: 12px; font-size: 14px; color: #666;">
                Доступно: 0.00000 ₲
            </div>
        </div>
        
        <div id="btnCurrencyRUB" class="currency-card">
            <div style="display: flex; align-items: center; gap: 12px;">
                <img src="photo/18.png" style="width: 32px; height: 32px; border-radius: 8px;">
                <div>
                    <div style="font-weight: 500; color: #1A1A1A;">RUB</div>
                    <div style="font-size: 13px; color: #909099;">Фиатные деньги</div>
                </div>
            </div>
            <div id="rubBalance" style="margin-top: 12px; font-size: 14px; color: #666;">
                Доступно: 0.00 ₽
            </div>
        </div>
    </div>

    <!-- Блок формы перевода -->
    <div class="transfer-form">
        <div class="transfer-field">
            <label class="transfer-label">Получатель</label>
            <input 
                type="text" 
                id="toUserIdInput" 
                placeholder="Введите ID пользователя" 
                class="transfer-input">
        </div>

        <div class="transfer-field">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <label class="transfer-label">Сумма</label>
                <div id="transferBalanceInfo" style="font-size: 13px; color: #909099;"></div>
            </div>
            <div class="transfer-amount">
                <input 
                    type="number" 
                    id="transferAmountInput"
                    placeholder="0.00">
                <span id="currencySymbol">₲</span>
            </div>
        </div>
    </div>

    <!-- Кнопка отправки -->
    <button id="sendTransferBtn" class="transfer-submit-btn">
        Подтвердить перевод
    </button>
</div>
    `,
    {
      showCloseBtn: true,
      cornerTopMargin: 0,
      cornerTopRadius: 0,
      hasVerticalScroll: true,
      defaultFromBottom: true,
      noRadiusByDefault: false
    }
  );

  // Подключаем общий стиль (как в разделе "обмен")
  const transferStyles = `
  /* Контейнер всего окна перевода */
  .transfer-container {
    background: #FFFFFF;
    border-radius: 16px;
    padding: 0px;
    margin-top: 25px;
    max-width: 440px;
  }
  /* Шапка и заголовок */
  .transfer-header {
    margin-bottom: 24px;
    text-align: center;
  }
  .transfer-title {
    font-size: 24px;
    font-weight: 600;
    color: #1A1A1A;
    margin: 0;
  }

  /* Блок выбора валюты */
  .currency-select {
    display: flex;
    gap: 12px;
    margin-bottom: 30px;
  }
  .currency-card {
    flex: 1;
    padding: 16px;
    border: 1px solid #E6E6EB;
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .currency-card.active {
    border-color: #2F80ED;
    background: #F5F9FF;
    box-shadow: 0 2px 8px rgba(47, 128, 237, 0.1);
  }

  /* Форма перевода */
  .transfer-form {
    background: #F8F9FB;
    border-radius: 16px;
    padding: 16px;
    margin-bottom: 24px;
  }
  .transfer-field {
    margin-bottom: 20px;
  }
  .transfer-label {
    display: block;
    font-size: 14px;
    color: #666;
    margin-bottom: 8px;
  }
  .transfer-input {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid #E6E6EB;
    border-radius: 12px;
    font-size: 15px;
    background: white;
  }

  /* Поле суммы с абсолютным символом */
  .transfer-amount {
    position: relative;
  }
  .transfer-amount input {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid #E6E6EB;
    border-radius: 12px;
    font-size: 24px;
    font-weight: 500;
    text-align: right;
    background: white;
  }
  .transfer-amount span {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 16px;
    color: #1A1A1A;
    font-weight: 500;
  }

  /* Кнопка отправки */
  .transfer-submit-btn {
    width: 100%;
    padding: 16px;
    background: linear-gradient(90deg, #2F80ED, #2D9CDB);
    border: none;
    border-radius: 12px;
    color: white;
    font-weight: 600;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .transfer-submit-btn:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  .transfer-submit-btn:active {
    transform: translateY(0);
  }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = transferStyles;
  document.head.appendChild(styleEl);

  /**************************************************
   * Основная логика
   **************************************************/
  // Текущая валюта "GUGA" или "RUB"
  let currentTransferCurrency = "GUGA";

  const formatBalanceLocal = (balance, decimals) => {
    return balance.toFixed(decimals);
  };

  // Обновление UI при переключении валют
  const updateTransferUI = () => {
    const currencySymbol = document.getElementById("currencySymbol");
    const balanceInfo = document.getElementById("transferBalanceInfo");
    const gugaBalance = document.getElementById("gugaBalance");
    const rubBalance = document.getElementById("rubBalance");

    // Сброс "active" у всех карточек
    document.querySelectorAll('.currency-card').forEach(card => {
      card.classList.remove('active');
    });

    // Ставим "active" на нужную
    const activeCard = (currentTransferCurrency === "GUGA")
      ? document.getElementById("btnCurrencyGUGA")
      : document.getElementById("btnCurrencyRUB");
    activeCard.classList.add('active');

    // Меняем символ валюты, шаг ввода, и отображение балансов
    if (currentTransferCurrency === "GUGA") {
      const balance = parseFloat(document.getElementById("gugaBalanceValue")?.innerText || 0);
      currencySymbol.textContent = '₲';
      document.getElementById("transferAmountInput").step = "0.00001";
      gugaBalance.innerHTML = `Доступно: ${formatBalanceLocal(balance, 5)} ₲`;
      balanceInfo.textContent = `Макс: ${formatBalanceLocal(balance, 5)} ₲`;
    } else {
      const balance = parseFloat(document.getElementById("rubBalanceValue")?.innerText || 0);
      currencySymbol.textContent = '₽';
      document.getElementById("transferAmountInput").step = "0.01";
      rubBalance.innerHTML = `Доступно: ${formatBalanceLocal(balance, 2)} ₽`;
      balanceInfo.textContent = `Макс: ${formatBalanceLocal(balance, 2)} ₽`;
    }
  };

  // Переключение валют
  document.getElementById("btnCurrencyGUGA").addEventListener('click', () => {
    currentTransferCurrency = "GUGA";
    updateTransferUI();
  });
  document.getElementById("btnCurrencyRUB").addEventListener('click', () => {
    currentTransferCurrency = "RUB";
    updateTransferUI();
  });

  // Кнопка "Отправить"
  document.getElementById("sendTransferBtn").onclick = async () => {
    const toUser = document.getElementById("toUserIdInput")?.value.trim();
    const amount = parseFloat(document.getElementById("transferAmountInput")?.value);
    if (!toUser || !amount || amount <= 0) {
      alert("❌ Введите корректные данные!");
      return;
    }
    if (toUser === currentUserId) {
      alert("❌ Нельзя перевести самому себе");
      return;
    }

    // Выбираем эндпоинт в зависимости от валюты
    const endpoint = (currentTransferCurrency === "GUGA") ? "/transfer" : "/transferRub";

    try {
      const resp = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: toUser, amount })
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
      alert("Произошла ошибка при выполнении перевода");
    }
  };

  // После загрузки балансов — обновим отображение
  fetchUserData().then(() => {
    // Обновляем rubBalance, если нужно
    const rubBalanceElement = document.getElementById("rubBalance");
    const rubBalanceValue = parseFloat(document.getElementById("rubBalanceValue")?.innerText || 0);
    if (rubBalanceElement) {
      rubBalanceElement.textContent = `Доступно: ${rubBalanceValue.toFixed(2)} ₽`;
    }
    // Первичная инициализация UI
    updateTransferUI();
  });
}

/**************************************************
 * ОПЛАТА ПО QR (также оставляем радиус)
 **************************************************/
function openPayQRModal() {
  createModal(
    "payQRModal",
    `
      <div class="qr-scanner-wrapper">
        <video id="opPayVideo" muted playsinline></video>
        <div class="scanner-overlay"></div>
        <div class="scan-frame">
          <div class="corner top-left"></div>
          <div class="corner top-right"></div>
          <div class="corner bottom-left"></div>
          <div class="corner bottom-right"></div>
        </div>
      </div>
    `,
    {
      showCloseBtn: false,
      customStyles: {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.9)',
        zIndex: 10000,
        padding: '0',
        overflow: 'hidden'
      }
    }
  );

  const style = document.createElement('style');
  style.innerHTML = `
    .qr-scanner-wrapper {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }

    #opPayVideo {
      position: absolute;
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scale(1.02); /* Убирает чёрные полосы у некоторых камер */
    }

    .scan-frame {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 80%;
      max-width: 400px;
      height: 60vh;
      max-height: 400px;
      z-index: 2;
      pointer-events: none;
    }

    .corner {
      position: absolute;
      width: 24px;
      height: 24px;
      border: 3px solid #fff;
    }

    .top-left {
      top: 0;
      left: 0;
      border-right: none;
      border-bottom: none;
    }

    .top-right {
      top: 0;
      right: 0;
      border-left: none;
      border-bottom: none;
    }

    .bottom-left {
      bottom: 0;
      left: 0;
      border-right: none;
      border-top: none;
    }

    .bottom-right {
      bottom: 0;
      right: 0;
      border-left: none;
      border-top: none;
    }

    .scanner-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        to bottom,
        rgba(0,0,0,0.6) 0,
        rgba(0,0,0,0.6) 40px,
        transparent 40px,
        transparent calc(100% - 80px),
        rgba(0,0,0,0.6) calc(100% - 80px),
        rgba(0,0,0,0.6) 100%
      );
      z-index: 1;
      pointer-events: none;
    }

    @media (orientation: landscape) {
      .scan-frame {
        width: 60vh;
        height: 80%;
      }
    }
  `;
  document.head.appendChild(style);

  const videoEl = document.getElementById("opPayVideo");
  startUniversalQRScanner(videoEl, (rawValue) => {
    const parsed = parseQRCodeData(rawValue);
    if (parsed.type === "person") {
      // Обработка перевода между пользователями
      if (!parsed.userId) {
        alert("❌ Неверный QR. Нет userId.");
        return;
      }
      confirmPayUserModal(parsed);
    } else if (parsed.type === "merchant") {
      // Обработка оплаты мерчанту
      if (!parsed.merchantId) {
        alert("❌ Неверный QR. Нет merchantId.");
        return;
      }
      confirmPayMerchantModal(parsed);
    } else {
      alert("❌ Неверный тип QR-кода.");
      return;
    }

    // Закрываем окно сканера после успешного сканирования
    setTimeout(() => {
      document.getElementById("payQRModal")?.remove();
    }, 500);
  });
}

/**************************************************
 * Подтверждение оплаты мерчанту
 **************************************************/
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
      cornerTopRadius: 20,
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
      console.error("Ошибка оплаты мерчанту:", err);
    }
  };
}

/**************************************************
 * Подтверждение перевода между пользователями (стилизованная версия)
 **************************************************/
async function confirmPayUserModal({ userId, amount, purpose }) {
  // Валидация основных параметров
  if (!userId || !amount || amount <= 0) {
    showNotification("❌ Некорректные данные для перевода", "error");
    return;
  }

  createModal(
    "confirmPayUserModal",
    `
      <div style="
        max-width: 400px;
        margin: 0 auto;
        padding: 24px;
        background: #FFFFFF;
        border-radius: 24px;
        box-shadow: 0px 4px 20px rgba(0, 0, 0, 0.1);
        margin-top: 60px;
      ">
        <div style="
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        ">
          <img src="photo/15.png" style="width: 40px; height: 40px;">
          <div>
            <div style="font-size: 20px; font-weight: 600; color: #1A1A1A;">Подтверждение перевода</div>
            <div style="font-size: 16px; color: #666;">Операция с GUGA</div>
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <div style="
            background: #F8F9FB;
            border-radius: 16px;
            padding: 16px;
            margin-bottom: 16px;
          ">
            <div style="color: #666; font-size: 14px; margin-bottom: 4px;">Получатель</div>
            <div style="font-weight: 500; color: #1A1A1A;">${userId}</div>
          </div>

          <div style="
            background: #F8F9FB;
            border-radius: 16px;
            padding: 16px;
          ">
            <div style="color: #666; font-size: 14px; margin-bottom: 4px;">Сумма</div>
            <div style="font-weight: 500; color: #1A1A1A;">${formatBalance(amount, 5)} ₲</div>
          </div>
        </div>

        ${purpose ? `
          <div style="
            background: #F8F9FB;
            border-radius: 16px;
            padding: 16px;
            margin-bottom: 24px;
          ">
            <div style="color: #666; font-size: 14px; margin-bottom: 4px;">Назначение</div>
            <div style="font-weight: 500; color: #1A1A1A;">${purpose}</div>
          </div>
        ` : ''}

        <button 
          id="confirmPayUserBtn" 
          style="
            width: 100%;
            padding: 16px;
            background: linear-gradient(90deg, #2F80ED, #2D9CDB);
            border: none;
            border-radius: 12px;
            color: white;
            font-weight: 600;
            font-size: 16px;
            cursor: pointer;
            transition: opacity 0.2s;
          ">
          Подтвердить перевод
        </button>
      </div>
    `,
    {
      showCloseBtn: true,
      cornerTopMargin: 20,
      cornerTopRadius: 24,
      hasVerticalScroll: true,
      defaultFromBottom: true,
      noRadiusByDefault: false,
      contentMaxHeight: "calc(100vh - 160px)",
    }
  );

  document.getElementById("confirmPayUserBtn").onclick = async () => {
    try {
      if (!currentUserId) throw new Error("Требуется авторизация");
      
      const payload = {
        fromUserId: currentUserId,
        toUserId: userId,
        amount: Number(amount),
        purpose: purpose || ""
      };

      const resp = await fetch(`${API_URL}/transfer`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await resp.json();
      
      if (!resp.ok || !data.success) {
        throw new Error(data.error || "Ошибка сервера");
      }

      showNotification("✅ Перевод успешно выполнен", "success");
      document.getElementById("confirmPayUserModal")?.remove();
      await fetchUserData();
      
    } catch (err) {
      console.error("Ошибка перевода:", err);
      showNotification(`❌ ${err.message}`, "error");
    }
  };
}

/**************************************************
 * Вспомогательная функция для парсинга QR-кода
 **************************************************/
function parseQRCodeData(qrString) {
  const obj = { type: null, userId: null, merchantId: null, amount: 0, purpose: "" };
  try {
    if (!qrString.startsWith("guga://")) return obj;
    const query = qrString.replace("guga://", "");
    const parts = query.split("&");
    for (const part of parts) {
      const [key, val] = part.split("=");
      if (key === "type") obj.type = val; // Тип: "person" или "merchant"
      if (key === "userId") obj.userId = val; // ID пользователя
      if (key === "merchantId") obj.merchantId = val; // ID мерчанта
      if (key === "amount") obj.amount = parseFloat(val);
      if (key === "purpose") obj.purpose = decodeURIComponent(val);
    }
  } catch (err) {
    console.error("Ошибка при разборе QR-кода:", err);
  }
  return obj;
}

/**************************************************
 * ОБМЕН ВАЛЮТЫ (ПОЛНАЯ ВЕРСИЯ, С ДОРАБОТКАМИ)
 **************************************************/
let currentExchangeDirection = "coin_to_rub";
let currentExchangeRate = 0;

function openExchangeModal() {
  showGlobalLoading();
  createModal(
    "exchangeModal",
    `
<div class="exchange-container">
    <div class="exchange-header">
        <div class="header-info">
            <div class="exchange-title">Обмен валюты</div>
            <div id="currentRate" class="current-rate">1 ₲ = 0.00 ₽</div>
        </div>
    </div>

    <div class="chart-container">
        <div class="chart-header">
            <span class="rate-label">Курс GUGA/RUB</span>
            <div class="rate-change">
                <span id="rateChangeArrow" class="rate-arrow">→</span>
                <span id="rateChangePercent" class="rate-percent">0.00%</span>
            </div>
        </div>
        <div class="chart-wrapper">
            <canvas id="exchangeChart"></canvas>
        </div>
    </div>
    
    <div class="currency-block from-currency">
        <div class="currency-header">
            <span class="currency-label">Отдаёте</span>
            <span id="fromBalance" class="balance">0.00000 ₲</span>
        </div>
        <div class="input-group">
            <input 
                type="number" 
                id="amountInput" 
                placeholder="0.00" 
                class="currency-input">
            <div class="currency-display">
                <img src="photo/15.png" class="currency-icon">
                <span class="currency-symbol">GUGA</span>
            </div>
        </div>
    </div>

    <!-- Кнопка свапа (меняет местами валюты) -->
    <button id="swapBtn" class="swap-btn">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <path d="M8 11L12 7L16 11M16 13L12 17L8 13" stroke="#2F80ED" stroke-width="2"/>
        </svg>
    </button>

    <div class="currency-block to-currency">
        <div class="currency-header">
            <span class="currency-label">Получаете</span>
            <span id="toBalance" class="balance">0.00 ₽</span>
        </div>
        <div class="input-group">
            <input 
                type="text" 
                id="toAmount" 
                placeholder="0.00" 
                class="currency-input"
                disabled>
            <div class="currency-display">
                <img src="photo/18.png" class="currency-icon">
                <span class="currency-symbol">RUB</span>
            </div>
        </div>
    </div>

    <!-- Кнопка подтверждения обмена -->
    <button id="btnPerformExchange" class="submit-btn">
        Подтвердить обмен
    </button>

    <!-- Отступ снизу, чтобы кнопка не перекрывалась -->
    <div class="bottom-spacer"></div>
</div>
    `,
    {
      showCloseBtn: false,
      cornerTopMargin: 0,
      cornerTopRadius: 0,
      contentMaxHeight: "100vh",
      noRadiusByDefault: true
    }
  );

  initExchange();
}

/**************************************************
 * СТИЛИ (CSS), включая анимацию вращения
 **************************************************/
const exchangeStyles = `
.exchange-container {
  /* Добавим нижний отступ, чтобы ничего не перекрывало кнопку */
  margin-bottom: 150px; 
}

.exchange-header {
  margin-bottom: 32px;
}

.exchange-title {
  font-size: 24px;
  font-weight: 600;
  color: #1A1A1A;
  margin-bottom: 8px;
}

.current-rate {
  font-size: 24px;
  color: #666;
}

.chart-container {
  background: #F8F9FB;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 24px;
}

.chart-wrapper canvas {
  height: 200px !important;
}

.currency-block {
  background: #F8F9FB;
  border-radius: 16px;
  padding: 16px;
  margin: 8px 0; /* УМЕНЬШЕННЫЙ зазор (было 12px) */
}

.currency-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.balance {
  font-weight: 500;
}

/* Кнопка свапа (круглая, с анимацией) */
.swap-btn {
  width: 56px;
  height: 56px;
  background: #F8F9FB;
  border: 2px solid #E6E6EB;
  border-radius: 50%; /* Делаем кнопку круглой */
  margin: 16px auto;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s, transform 0.2s;
  cursor: pointer;
}

.swap-btn:hover {
  background: #eef0f3;
}

/* Анимация вращения */
@keyframes swapRotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* При "активном" нажатии запускаем анимацию */
.swap-btn:active {
  animation: swapRotate 0.5s forwards ease;
}

.input-group {
  display: flex;
  gap: 12px;
  align-items: center;
}

.currency-input {
  flex: 1;
  border: none;
  background: none;
  font-size: 20px;
  padding: 12px 0;
  color: #1A1A1A;
  font-weight: 500;
}

.currency-input::placeholder {
  color: #B1B8C5;
}

.currency-display {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #F8F9FB;
  border-radius: 12px;
  padding: 10px 16px;
  border: 1px solid #E6E6EB;
}

/* Кнопка "Подтвердить обмен" */
.submit-btn {
  position: fixed;
  bottom: 20px;
  left: 16px;
  right: 16px;
  padding: 18px;
  background: linear-gradient(90deg, #2F80ED, #2D9CDB);
  border: none;
  border-radius: 12px;
  color: white;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  box-shadow: 0px 4px 15px rgba(0, 0, 0, 0.1);
  z-index: 9999; /* Поверх других элементов */
  margin-bottom: 80px;
}

/* Небольшой отступ, чтобы внизу был воздух */
.bottom-spacer {
  height: 0px;
}
`;

// Подключаем стили к документу (можно и один раз в createModal, если хотите)
const style = document.createElement('style');
style.textContent = exchangeStyles;
document.head.appendChild(style);

/**************************************************
 * ИНИЦИАЛИЗАЦИЯ ОБМЕНА
 **************************************************/
async function initExchange() {
  try {
    const [ratesResp, userResp] = await Promise.all([
      fetch(`${API_URL}/exchangeRates?limit=50`),
      fetch(`${API_URL}/user`, { credentials: "include" })
    ]);

    const ratesData = await ratesResp.json();
    const userData = await userResp.json();

    if (ratesData.success) {
      currentExchangeRate = ratesData.rates[0]?.exchange_rate || 0;
      updateRateDisplay(ratesData.rates);
      initChart(ratesData.rates);
    }

    if (userData.success) {
      document.getElementById('fromBalance').textContent =
        formatBalance(userData.user.balance, 5) + " ₲";
      document.getElementById('toBalance').textContent =
        formatBalance(userData.user.rub_balance, 2) + " ₽";
    }

    document.getElementById('swapBtn').addEventListener('click', swapCurrencies);
    document.getElementById('amountInput').addEventListener('input', updateConversion);
    document.getElementById('btnPerformExchange').addEventListener('click', performExchange);
  } catch (error) {
    showNotification('Не удалось загрузить данные', 'error');
    console.error(error);
  } finally {
    hideGlobalLoading();
  }
}

/**************************************************
 * ОТОБРАЖЕНИЕ ТЕКУЩЕГО КУРСА (+ РАЗНИЦА В %)
 **************************************************/
function updateRateDisplay(rates) {
  if (!rates || rates.length < 2) return;

  const current = rates[0].exchange_rate;
  const previous = rates[1].exchange_rate;
  const diff = current - previous;
  const percent = (diff / previous) * 100;

  document.getElementById('currentRate').textContent =
    `1 ₲ = ${formatBalance(current, 2)} ₽`;

  const arrow = document.getElementById('rateChangeArrow');
  const ratePercent = document.getElementById('rateChangePercent');

  if (diff > 0) {
    arrow.textContent = '↑';
    arrow.style.color = '#4BA857';
    ratePercent.textContent = `+${percent.toFixed(2)}%`;
    ratePercent.style.color = '#4BA857';
  } else {
    arrow.textContent = '↓';
    arrow.style.color = '#D21B1B';
    ratePercent.textContent = `${percent.toFixed(2)}%`;
    ratePercent.style.color = '#D21B1B';
  }
}

/**************************************************
 * ИНИЦИАЛИЗАЦИЯ ГРАФИКА
 **************************************************/
function initChart(rates) {
  const ctx = document.getElementById('exchangeChart').getContext('2d');
  const labels = rates.slice(0, 50).reverse().map(r =>
    new Date(r.created_at).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    })
  );

  if (exchangeChartInstance) exchangeChartInstance.destroy();

  exchangeChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: rates.slice(0, 50).reverse().map(r => r.exchange_rate),
        borderWidth: 2,
        borderColor: '#2F80ED',
        tension: 0.4,
        fill: false,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: {
          position: 'right',
          grid: { color: '#E6E6EB' },
          ticks: {
            color: '#76808F',
            callback: value => `${value} ₽`
          }
        }
      }
    }
  });
}

/**************************************************
 * ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ БАЛАНСОВ
 **************************************************/
function parseBalanceString(str) {
  // Пример: "123.456 ₲" или "999.00 ₽"
  const parts = str.trim().split(" ");
  if (parts.length < 2) {
    // На случай если формат неожиданно другой
    return { amount: 0, symbol: "" };
  }
  const amount = parseFloat(parts[0]) || 0;
  const symbol = parts[1];
  return { amount, symbol };
}

function formatBalanceValue(num, symbol) {
  // Если это GUGA (₲), 5 знаков; если RUB (₽), 2 знака
  if (symbol === "₲") {
    return formatBalance(num, 5) + " ₲";
  } else if (symbol === "₽") {
    return formatBalance(num, 2) + " ₽";
  }
  // На случай других валют
  return num + " " + symbol;
}

/**************************************************
 * ФУНКЦИЯ "SWAP" (МЕНЯЕТ МЕСТАМИ ВАЛЮТЫ + АНИМАЦИЯ)
 **************************************************/
function swapCurrencies() {
  // Запускаем анимацию вращения через JS (дополнительно к :active)
  const swapBtn = document.getElementById('swapBtn');
  swapBtn.style.animation = 'swapRotate 0.5s forwards ease';
  setTimeout(() => { swapBtn.style.animation = 'none'; }, 500);

  // Меняем направление
  currentExchangeDirection =
    currentExchangeDirection === 'coin_to_rub' ? 'rub_to_coin' : 'coin_to_rub';
  
  const fromDisplay = document.querySelector('.from-currency .currency-display');
  const toDisplay = document.querySelector('.to-currency .currency-display');
  const fromBalanceEl = document.getElementById('fromBalance');
  const toBalanceEl = document.getElementById('toBalance');
  const amountInput = document.getElementById('amountInput');
  const toAmount = document.getElementById('toAmount');

  // 1) Меняем местами введённые значения
  [amountInput.value, toAmount.value] = [toAmount.value, amountInput.value];
  
  // 2) Меняем местами отображаемые валюты (иконки и подписи)
  if (currentExchangeDirection === 'coin_to_rub') {
    fromDisplay.innerHTML = `
      <img src="photo/15.png" class="currency-icon">
      <span class="currency-symbol">GUGA</span>
    `;
    toDisplay.innerHTML = `
      <img src="photo/18.png" class="currency-icon">
      <span class="currency-symbol">RUB</span>
    `;
  } else {
    // rub_to_coin
    fromDisplay.innerHTML = `
      <img src="photo/18.png" class="currency-icon">
      <span class="currency-symbol">RUB</span>
    `;
    toDisplay.innerHTML = `
      <img src="photo/15.png" class="currency-icon">
      <span class="currency-symbol">GUGA</span>
    `;
  }

  // 3) Меняем местами балансы (числовые значения + символ)
  const oldFrom = parseBalanceString(fromBalanceEl.textContent);
  const oldTo = parseBalanceString(toBalanceEl.textContent);

  // Теперь если direction = coin_to_rub, то fromBalance должен показывать GUGA (старый to, если он был GUGA)
  // Но на практике — просто меняем местами, а иконка/подпись уже выставлена выше
  fromBalanceEl.textContent = formatBalanceValue(oldTo.amount, oldFrom.symbol);
  toBalanceEl.textContent = formatBalanceValue(oldFrom.amount, oldTo.symbol);

  // 4) Обновляем вычисление
  updateConversion();
}

/**************************************************
 * ПЕРЕРАСЧЁТ ЗНАЧЕНИЙ ПРИ ВВОДЕ
 **************************************************/
function updateConversion() {
  const input = document.getElementById('amountInput');
  const output = document.getElementById('toAmount');
  const value = parseFloat(input.value) || 0;

  if (currentExchangeDirection === 'coin_to_rub') {
    output.value = formatBalance(value * currentExchangeRate, 2);
  } else {
    output.value = formatBalance(value / currentExchangeRate, 5);
  }
}

/**************************************************
 * ВЫПОЛНЕНИЕ ОБМЕНА (API-ЗАПРОС)
 **************************************************/
async function performExchange() {
  const amount = parseFloat(document.getElementById('amountInput').value);

  if (!amount || amount <= 0) {
    showNotification('Введите корректную сумму', 'error');
    return;
  }

  // Защита от двойного обмена подряд
  if (lastDirection === currentExchangeDirection) {
    showNotification('Пожалуйста, обновите курс или смените направление', 'error');
    return;
  }

  showGlobalLoading();

  try {
    const response = await fetch(`${API_URL}/exchange`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        direction: currentExchangeDirection,
        amount
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Ошибка обмена');
    }

    showNotification('Обмен выполнен успешно!', 'success');

    // Запоминаем последнее направление
    lastDirection = currentExchangeDirection;
    // Через 5 секунд сбрасываем
    setTimeout(() => { lastDirection = null; }, 5000);

    // Снова грузим актуальные данные (балансы, курс)
    await initExchange();

  } catch (error) {
    showNotification(error.message, 'error');
    console.error(error);
  } finally {
    hideGlobalLoading();
  }
}

/**************************************************
 * ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
 **************************************************/
function formatBalance(num, decimals = 5, defaultValue = "0.00000") {
  const parsed = parseFloat(num);
  if (isNaN(parsed)) return defaultValue;
  return parsed.toFixed(decimals);
}

function showNotification(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
  // Реализуйте свою логику, например, тосты на экране
}

function showGlobalLoading() {
  const loader = document.getElementById('loadingIndicator');
  if (loader) loader.style.display = 'flex';
}

function hideGlobalLoading() {
  const loader = document.getElementById('loadingIndicator');
  if (loader) loader.style.display = 'none';
}

/**************************************************
 * ИСТОРИЯ (единый стиль без кнопки закрытия, без радиуса)
 **************************************************/

function openHistoryModal(horizontalSwitch) {
  createModal(
    "historyModal",
    `
      <div class="history-container">
        <div class="history-header">
          <h2 class="history-title">История</h2>
        </div>
        <div class="history-content">
          <ul id="transactionList" class="transaction-list"></ul>
        </div>
      </div>
    `,
    {
      showCloseBtn: false, // без кнопки закрытия
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

/**
 * Запрашиваем историю транзакций и выводим в списке
 */
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

/**
 * Отрисовываем историю в DOM
 */
function displayTransactionHistory(transactions) {
  const list = document.getElementById("transactionList");
  if (!list) return;
  list.innerHTML = "";

  if (!transactions.length) {
    list.innerHTML = "<li class='no-operations'>Нет операций</li>";
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
    return dB - dA; // более свежие сверху
  });

  sortedDates.forEach((dateStr) => {
    const dateItem = document.createElement("li");
    dateItem.className = "transaction-group";

    const dateHeader = document.createElement("div");
    dateHeader.className = "transaction-date";
    dateHeader.textContent = dateStr;
    dateItem.appendChild(dateHeader);

    groups[dateStr].forEach((tx) => {
      const timeStr = new Date(tx.client_time || tx.created_at).toLocaleTimeString("ru-RU");

      let iconSrc = "";
      let titleText = "";
      let detailsText = "";
      let amountSign = "";
      let amountValue = formatBalance(tx.amount, 5);
      let currencySymbol = "₲";
      let color = "#000";

      if (tx.currency === "RUB") {
        amountValue = formatBalance(tx.amount, 2);
        currencySymbol = "₽";
      }

      if (tx.type === "merchant_payment") {
        iconSrc = "photo/92.png";
        titleText = "Оплата по QR";
        detailsText = `Мерчант: ${
          tx.merchant_id ||
          (tx.to_user_id && tx.to_user_id.replace("MERCHANT:", "")) ||
          "???"
        }`;
        amountSign = "-";
        color = "#000";
      } else if (tx.from_user_id === currentUserId) {
        iconSrc = "photo/67.png";
        titleText = "Отправлено";
        detailsText = `Кому: ${tx.to_user_id}`;
        amountSign = "-";
        color = "#000";
      } else if (tx.to_user_id === currentUserId) {
        iconSrc = "photo/66.png";
        titleText = "Получено";
        detailsText = `От кого: ${tx.from_user_id}`;
        amountSign = "+";
        color = "rgb(25, 150, 70)";
      } else if (tx.type === "exchange") {
        iconSrc = "photo/67.png";
        titleText = "Обмен";
        detailsText = `Направление: ${
          tx.direction === "rub_to_coin" ? "Рубли → Монеты" : "Монеты → Рубли"
        }`;
        amountSign = tx.direction === "rub_to_coin" ? "+" : "-";
        color = tx.direction === "rub_to_coin"
          ? "rgb(25, 150, 70)"
          : "rgb(102, 102, 102);";
        amountValue = formatBalance(tx.amount, 5);
        currencySymbol = tx.direction === "rub_to_coin" ? "₲" : "₽";
      }

      // Создаём "карточку" одной транзакции
      const cardDiv = document.createElement("div");
      cardDiv.className = "transaction-card";

      // Левая часть (иконка)
      const leftDiv = document.createElement("div");
      leftDiv.className = "transaction-icon-wrap";

      const iconImg = document.createElement("img");
      iconImg.src = iconSrc;
      iconImg.alt = "icon";
      iconImg.style.width = "34px";
      iconImg.style.height = "34px";
      leftDiv.appendChild(iconImg);

      // Центр (текст)
      const centerDiv = document.createElement("div");
      centerDiv.className = "transaction-text-wrap";

      const titleEl = document.createElement("div");
      titleEl.className = "transaction-title";
      titleEl.textContent = titleText;

      const detailsEl = document.createElement("div");
      detailsEl.className = "transaction-subtitle";
      detailsEl.textContent = detailsText;

      centerDiv.appendChild(titleEl);
      centerDiv.appendChild(detailsEl);

      // Правая часть (сумма + время)
      const rightDiv = document.createElement("div");
      rightDiv.className = "transaction-info-wrap";

      const amountEl = document.createElement("div");
      amountEl.className = "transaction-amount";
      amountEl.style.color = color;
      amountEl.textContent = `${amountSign}${amountValue} ${currencySymbol}`;

      const timeEl = document.createElement("div");
      timeEl.className = "transaction-time";
      timeEl.textContent = timeStr;

      rightDiv.appendChild(amountEl);
      rightDiv.appendChild(timeEl);

      // Собираем карточку
      cardDiv.appendChild(leftDiv);
      cardDiv.appendChild(centerDiv);
      cardDiv.appendChild(rightDiv);

      // Добавляем карточку в группу
      dateItem.appendChild(cardDiv);
    });

    list.appendChild(dateItem);
  });
}

/**
 * Форматируем дату как "Сегодня"/"Вчера"/"DD.MM.YYYY"
 */
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
  const obj = { type: null, userId: null, amount: 0, purpose: "" };
  try {
    if (!qrString.startsWith("guga://")) return obj;
    const query = qrString.replace("guga://", "");
    const parts = query.split("&");
    for (const p of parts) {
      const [key, val] = p.split("=");
      if (key === "type") obj.type = val; // Тип операции: "person" или "merchant"
      if (key === "userId") obj.userId = val; // ID получателя
      if (key === "amount") obj.amount = parseFloat(val);
      if (key === "purpose") obj.purpose = decodeURIComponent(val);
    }
  } catch (e) {
    console.error("Ошибка при разборе QR-кода:", e);
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
 * Display User Profile
 **************************************************/
function displayUserProfile() {
  // Получение данных пользователя
  const userPhotoUrl = currentUser.photo_url; // Предположим, что эти данные должны быть в currentUser
  const userFirstName = currentUser.first_name;

  // Создаем элементы
  const userInfoContainer = document.createElement("div");
  userInfoContainer.classList.add("user-info");

  const userPhoto = document.createElement("img");
  userPhoto.classList.add("user-photo");
  userPhoto.src = userPhotoUrl;
  userPhoto.alt = "User Photo";

  const userName = document.createElement("span");
  userName.classList.add("user-name");
  userName.textContent = userFirstName;

  // Добавляем элементы в контейнер
  userInfoContainer.appendChild(userPhoto);
  userInfoContainer.appendChild(userName);

  // Вставляем контейнер в DOM, например, в body
  document.body.appendChild(userInfoContainer);
}

/**************************************************
 * УВЕДОМЛЕНИЯ (TOASTS) - Единый стиль
 **************************************************/

// (1) Стили: заменяем на единый стиль, похожий на общий дизайн
const notificationStyle = document.createElement("style");
notificationStyle.textContent = `
  /* Контейнер для всех уведомлений */
  #notificationContainer {
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 9999999; /* выше всего */
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-end;
  }

  /* Общее оформление уведомления */
  .notification {
    font-family: "Oswald", sans-serif; /* единый шрифт */
    font-size: 14px;
    position: relative;
    min-width: 220px;
    max-width: 340px;
    word-break: break-word;

    background: #fff;               /* белый фон */
    border: 1px solid #E6E6EB;     /* тонкая граница */
    border-radius: 12px;           /* скруглённые углы */
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);

    color: #333;
    padding: 12px 16px;            /* чуть больше отступы */
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  /* Боковая цветная полоса для различия типов */
  .notification::before {
    content: "";
    display: block;
    position: absolute;
    left: 0; top: 0;
    width: 10px;
    height: 100%;
    border-radius: 12px 0 0 12px;   /* скругляем левую полосу */
  }

  /* Тип: success (цветной бордер слева) */
  .notification-success::before {
    background-color: #2F80ED; /* или #27AE60, если нужно "зелёный успех" */
  }

  /* Тип: error */
  .notification-error::before {
    background-color: #D21B1B;
  }

  /* Тип: info */
  .notification-info::before {
    background-color: #2D9CDB;
  }

  /* Кнопка "закрыть" */
  .notification-close {
    background: none;
    border: none;
    color: #999;
    font-size: 20px;
    cursor: pointer;
    margin-left: 8px;
    transition: color 0.2s;
  }
  .notification-close:hover {
    color: #666;
  }
`;
document.head.appendChild(notificationStyle);

// (2) Создаём контейнер под все уведомления, если не создан
const notificationContainer = document.createElement("div");
notificationContainer.id = "notificationContainer";
document.body.appendChild(notificationContainer);

/**
 * (3) Функция для показа уведомления в едином стиле.
 * @param {string} message Текст уведомления.
 * @param {'success'|'error'|'info'} [type='info'] Тип (цветное различие).
 * @param {number} [duration=5000] Время автозакрытия (мс). Если 0 — не закрывать автоматически.
 */
function showNotification(message, type = "info", duration = 5000) {
  const notif = document.createElement("div");
  notif.classList.add("notification");

  switch (type) {
    case "success":
      notif.classList.add("notification-success");
      break;
    case "error":
      notif.classList.add("notification-error");
      break;
    default:
      notif.classList.add("notification-info");
      break;
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

  // Автоудаление по таймеру
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

const API_URL = "https://mkntw-github-io.onrender.com"; // Убедитесь, что URL указан корректно
let currentUserId = null;

// Глобальные переменные для накопления добытых монет
let pendingMinedCoins = parseFloat(localStorage.getItem('pendingMinedCoins')) || 0;
let mineTimer = null;


/* ================================
   ФУНКЦИИ, КОТОРЫЕ ИСПОЛЬЗУЮТСЯ В UI
   ================================ */

/**
 * Функция выхода из аккаунта.
 */
function logout() {
  localStorage.removeItem('userId');
  currentUserId = null;
  const userInfo = document.getElementById('userInfo');
  const mineBtn = document.getElementById('mineBtn');
  const bottomBar = document.getElementById('bottomBar');
  if (userInfo) userInfo.classList.add('hidden');
  if (mineBtn) mineBtn.classList.add('hidden');
  if (bottomBar) {
    bottomBar.classList.add('hidden');
    bottomBar.style.display = 'none';
  }
  updateUI();
}

/**
 * Функция создания модального окна.
 */
function createModal(id, content) {
  let modal = document.getElementById(id);
  if (modal) return modal; // Если уже существует, возвращаем его
  modal = document.createElement('div');
  modal.id = id;
  modal.className = 'modal hidden';
  modal.innerHTML = `
    <div class="modal-content">
      ${content}
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal(id);
  });
  return modal;
}

/**
 * Открывает модальное окно с заданным id.
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('hidden');
}

/**
 * Закрывает модальное окно с заданным id.
 */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}

/**
 * Удаляет модальное окно аутентификации из DOM.
 */
function removeAuthModal() {
  const authModal = document.getElementById('authModal');
  if (authModal) authModal.remove();
}

/**
 * Открывает секцию входа (логин) в модальном окне аутентификации.
 */
function openLoginSection() {
  const loginSection = document.getElementById('loginSection');
  const registerSection = document.getElementById('registerSection');
  if (loginSection) loginSection.style.display = 'block';
  if (registerSection) registerSection.style.display = 'none';
}

/**
 * Открывает секцию регистрации в модальном окне аутентификации.
 */
function openRegisterSection() {
  const loginSection = document.getElementById('loginSection');
  const registerSection = document.getElementById('registerSection');
  if (loginSection) loginSection.style.display = 'none';
  if (registerSection) registerSection.style.display = 'block';
}

/**
 * Открытие модального окна аутентификации.
 */
function openAuthModal() {
  let authModal = document.getElementById('authModal');
  if (!authModal) {
    authModal = createModal('authModal', `
      <h3>GugaCoin</h3>
      <div id="loginSection">
        <h4>Вход</h4>
        <input type="text" id="loginInput" placeholder="Логин">
        <input type="password" id="passwordInput" placeholder="Пароль">
        <button id="loginSubmitBtn">Войти</button>
        <button id="switchToRegisterBtn">Зарегистрироваться</button>
      </div>
      <div id="registerSection" style="display: none;">
        <h4>Регистрация</h4>
        <input type="text" id="regLogin" placeholder="Логин">
        <input type="password" id="regPassword" placeholder="Пароль">
        <button id="registerSubmitBtn">Зарегистрироваться</button>
        <button id="switchToLoginBtn">Войти</button>
      </div>
    `);
    const loginSubmitBtn = authModal.querySelector('#loginSubmitBtn');
    const registerSubmitBtn = authModal.querySelector('#registerSubmitBtn');
    const switchToRegisterBtn = authModal.querySelector('#switchToRegisterBtn');
    const switchToLoginBtn = authModal.querySelector('#switchToLoginBtn');
    if (loginSubmitBtn) loginSubmitBtn.addEventListener('click', login);
    if (registerSubmitBtn) registerSubmitBtn.addEventListener('click', register);
    if (switchToRegisterBtn) switchToRegisterBtn.addEventListener('click', openRegisterSection);
    if (switchToLoginBtn) switchToLoginBtn.addEventListener('click', openLoginSection);
  }
  openLoginSection();
  openModal('authModal');
}

/**
 * Форматирует число баланса с точностью до 5 знаков после запятой.
 */
function formatBalance(balance) {
  return parseFloat(balance).toFixed(5);
}


/* ================================
   ФУНКЦИИ, СВЯЗАННЫЕ С ДОБЫЧЕЙ МОНЕТ
   ================================ */

/**
 * Функция mineCoins вызывается при клике на изображение «Майнить».
 * Вместо мгновенной отправки каждого клика, сумма добычи накапливается локально.
 */
function mineCoins() {
  if (!currentUserId) return;
  
  // Увеличиваем локальный счетчик добытых монет (0.00001 за клик)
  pendingMinedCoins = parseFloat((pendingMinedCoins + 0.00001).toFixed(5));
  localStorage.setItem('pendingMinedCoins', pendingMinedCoins);

  // Если уже запущен таймер, сбрасываем его и запускаем заново
  if (mineTimer) {
    clearTimeout(mineTimer);
  }
  mineTimer = setTimeout(() => {
    flushMinedCoins();
  }, 3000);
}

/**
 * Асинхронная функция отправки накопленных монет на сервер.
 * Если данные успешно переданы, счетчик сбрасывается.
 */
async function flushMinedCoins() {
  if (!currentUserId || pendingMinedCoins <= 0) return;
  try {
    const response = await fetch(`${API_URL}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUserId, amount: pendingMinedCoins })
    });
    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }
    // После успешной отправки сбрасываем накопленные монеты
    pendingMinedCoins = 0;
    localStorage.removeItem('pendingMinedCoins');
    fetchUserData();
  } catch (error) {
    console.error('[FlushMinedCoins] Ошибка:', error);
  }
}

/**
 * Синхронная отправка накопленных монет при закрытии/обновлении страницы.
 * Используется XMLHttpRequest, т.к. fetch не поддерживает синхронные запросы.
 */
function flushMinedCoinsSync() {
  if (!currentUserId || pendingMinedCoins <= 0) return;
  
  const xhr = new XMLHttpRequest();
  xhr.open("POST", `${API_URL}/update`, false); // false – синхронный запрос
  xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
  try {
    xhr.send(JSON.stringify({ userId: currentUserId, amount: pendingMinedCoins }));
    pendingMinedCoins = 0;
    localStorage.removeItem('pendingMinedCoins');
  } catch (error) {
    console.error('[FlushMinedCoinsSync] Ошибка:', error);
  }
}


/* ================================
   ФУНКЦИИ ДЛЯ РАБОТЫ С ДАННЫМИ ПОЛЬЗОВАТЕЛЯ
   ================================ */

/**
 * Создает базовый UI (информацию о пользователе, кнопку "Майнить", панель с кнопками).
 */
function createUI() {
  // Информация о пользователе
  let userInfo = document.getElementById('userInfo');
  if (!userInfo) {
    userInfo = document.createElement('div');
    userInfo.id = 'userInfo';
    userInfo.classList.add('hidden');
    userInfo.innerHTML = `
      <p id="userIdLabel"><strong>ID:</strong> <span id="userId"></span></p>
      <p id="balanceLabel"><strong>Баланс (₲):</strong> <span id="balance"></span></p>
      <p id="rubBalanceLabel"><strong>Баланс (₽):</strong> <span id="rubBalance"></span></p>
    `;
    document.body.appendChild(userInfo);
  }
  
  // Кнопка "Майнить"
  let mineBtn = document.getElementById('mineBtn');
  if (!mineBtn) {
    mineBtn = document.createElement('img');
    mineBtn.id = 'mineBtn';
    mineBtn.src = '11.jpg';
    mineBtn.alt = 'Майнить';
    mineBtn.classList.add('hidden');
    document.body.appendChild(mineBtn);
    mineBtn.addEventListener('click', mineCoins);
  }
  
  // Нижняя панель кнопок
  let bottomBar = document.getElementById('bottomBar');
  if (!bottomBar) {
    bottomBar = document.createElement('div');
    bottomBar.id = 'bottomBar';
    bottomBar.classList.add('hidden');
    bottomBar.innerHTML = `
      <button id="transferBtn">Перевод</button>
      <div class="divider"></div>
      <button id="historyBtn">История</button>
      <div class="divider"></div>
      <button id="logoutBtn">Выход</button>
    `;
    document.body.appendChild(bottomBar);
    // Привязываем обработчики – теперь функция logout уже определена
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    document.getElementById('transferBtn')?.addEventListener('click', openTransferModal);
    document.getElementById('historyBtn')?.addEventListener('click', openHistoryModal);
  }
}

/**
 * Обновляет видимость элементов UI в зависимости от того, залогинен ли пользователь.
 */
function updateUI() {
  const userInfo = document.getElementById('userInfo');
  const mineBtn = document.getElementById('mineBtn');
  const bottomBar = document.getElementById('bottomBar');
  
  if (currentUserId) {
    if (userInfo) userInfo.classList.remove('hidden');
    if (mineBtn) mineBtn.classList.remove('hidden');
    if (bottomBar) {
      bottomBar.classList.remove('hidden');
      bottomBar.style.display = 'flex';
    }
    removeAuthModal();
  } else {
    if (userInfo) userInfo.classList.add('hidden');
    if (mineBtn) mineBtn.classList.add('hidden');
    if (bottomBar) {
      bottomBar.classList.add('hidden');
      bottomBar.style.display = 'none';
    }
    openAuthModal();
  }
}

/**
 * Запрашивает данные пользователя с сервера и отображает их.
 */
async function fetchUserData() {
  try {
    const response = await fetch(`${API_URL}/user?userId=${currentUserId}`);
    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }
    const data = await response.json();
    if (data.success && data.user) {
      const balance = parseFloat(data.user.balance || 0);
      const halvingStep = data.user.halvingStep || 0;
      const rubMultiplier = 1 + halvingStep * 0.02;
      const rubBalance = (balance * rubMultiplier).toFixed(5);
      document.getElementById('userId').textContent = currentUserId;
      document.getElementById('balance').textContent = formatBalance(balance);
      document.getElementById('rubBalance').textContent = rubBalance;
    } else {
      console.error('[Fetch User Data] Error: Invalid response from server');
      document.getElementById('balance').textContent = '0.00000';
      document.getElementById('rubBalance').textContent = '0.00000';
    }
  } catch (error) {
    console.error('[Fetch User Data] Error:', error.message);
    document.getElementById('balance').textContent = '0.00000';
    document.getElementById('rubBalance').textContent = '0.00000';
  }
}


/* ================================
   ФУНКЦИИ ДЛЯ ПЕРЕВОДА И ИСТОРИИ ОПЕРАЦИЙ
   ================================ */

/**
 * Открывает модальное окно перевода монет.
 */
function openTransferModal() {
  const modal = createModal('transferModal', `
    <h3>Перевод монет</h3>
    <label for="toUserIdInput">Кому (ID пользователя):</label>
    <input type="text" id="toUserIdInput" placeholder="Введите ID получателя">
    <label for="transferAmountInput">Количество:</label>
    <input type="number" id="transferAmountInput" step="0.00001" placeholder="Введите сумму">
    <button id="sendTransferBtn">Отправить</button>
    <button class="close-btn">X</button>
  `);
  const closeTransferBtn = modal.querySelector('.close-btn');
  const sendTransferBtn = modal.querySelector('#sendTransferBtn');
  if (closeTransferBtn) closeTransferBtn.addEventListener('click', () => closeModal('transferModal'));
  if (sendTransferBtn) sendTransferBtn.addEventListener('click', sendTransfer);
  openModal('transferModal');
}

/**
 * Отправляет перевод монет на сервер.
 */
async function sendTransfer() {
  const toUserId = document.getElementById('toUserIdInput')?.value;
  const amount = parseFloat(document.getElementById('transferAmountInput')?.value);
  if (!toUserId || !amount || amount <= 0) {
    alert('❌ Введите корректные данные');
    return;
  }
  if (toUserId === currentUserId) {
    alert('❌ Вы не можете перевести монеты самому себе');
    return;
  }
  try {
    const response = await fetch(`${API_URL}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromUserId: currentUserId, toUserId, amount })
    });
    const data = await response.json();
    if (data.success) {
      alert(`✅ Перевод успешен! Новый баланс: ${formatBalance(data.fromBalance)}`);
      closeModal('transferModal');
      fetchUserData();
    } else {
      alert(`❌ Ошибка перевода: ${data.error}`);
    }
  } catch (error) {
    console.error(error);
    alert('🚫 Ошибка сети');
  }
}

/**
 * Открывает модальное окно истории транзакций.
 */
function openHistoryModal() {
  const modal = createModal('historyModal', `
    <h3>История операций</h3>
    <div class="scrollable-content">
      <ul id="transactionList"></ul>
    </div>
    <button class="close-btn">X</button>
  `);
  const closeHistoryBtn = modal.querySelector('.close-btn');
  if (closeHistoryBtn) closeHistoryBtn.addEventListener('click', () => closeModal('historyModal'));
  fetchTransactionHistory();
  openModal('historyModal');
}

/**
 * Запрашивает историю транзакций с сервера.
 */
async function fetchTransactionHistory() {
  try {
    const response = await fetch(`${API_URL}/transactions?userId=${currentUserId}`);
    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }
    const data = await response.json();
    if (data.success && data.transactions) {
      displayTransactionHistory(data.transactions);
    } else {
      console.error('[Fetch Transactions] Error: Invalid response from server');
    }
  } catch (error) {
    console.error('[Fetch Transactions] Error:', error.message);
  }
}

/**
 * Отображает историю транзакций в модальном окне.
 */
function displayTransactionHistory(transactions) {
  const transactionList = document.getElementById('transactionList');
  if (transactionList) transactionList.innerHTML = '';
  if (transactions.length === 0) {
    if (transactionList) transactionList.innerHTML = '<li>Нет операций</li>';
    return;
  }
  transactions.forEach(tx => {
    const li = document.createElement('li');
    const date = new Date(tx.created_at).toLocaleString();
    const amount = formatBalance(tx.amount);
    if (tx.type === 'sent') {
      li.textContent = `Переведено: ${amount} монет пользователю ${tx.to_user_id} (${date})`;
    } else {
      li.textContent = `Получено: ${amount} монет от пользователя ${tx.from_user_id} (${date})`;
    }
    if (transactionList) transactionList.appendChild(li);
  });
}


/* ================================
   ФУНКЦИИ ДЛЯ РЕГИСТРАЦИИ И АВТОРИЗАЦИИ
   ================================ */

/**
 * Регистрирует нового пользователя.
 */
async function register() {
  const login = document.getElementById('regLogin')?.value;
  const password = document.getElementById('regPassword')?.value;
  if (!login || !password) {
    alert('❌ Введите логин и пароль');
    return;
  }
  try {
    const response = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: login, password })
    });
    const data = await response.json();
    if (data.success) {
      alert(`✅ Аккаунт создан! Ваш ID: ${data.userId}`);
      currentUserId = data.userId;
      localStorage.setItem('userId', currentUserId);
      createUI();
      updateUI();
      fetchUserData();
    } else {
      alert(`❌ Ошибка регистрации: ${data.error}`);
    }
  } catch (error) {
    console.error(error);
    alert('🚫 Ошибка сети');
  }
}

/**
 * Авторизует пользователя.
 */
async function login() {
  const login = document.getElementById('loginInput')?.value;
  const password = document.getElementById('passwordInput')?.value;
  if (!login || !password) {
    alert('❌ Введите логин и пароль');
    return;
  }
  try {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: login, password })
    });
    const data = await response.json();
    if (data.success) {
      currentUserId = data.userId;
      localStorage.setItem('userId', currentUserId);
      createUI();
      updateUI();
      fetchUserData();
      alert(`✅ Вы успешно зашли в аккаунт! Ваш ID: ${currentUserId}`);
    } else {
      alert(`❌ Ошибка входа: ${data.error}`);
    }
  } catch (error) {
    console.error(error);
    alert('🚫 Ошибка сети');
  }
}


/* ================================
   ИНИЦИАЛИЗАЦИЯ
   ================================ */
   
document.addEventListener('DOMContentLoaded', () => {
  // Если до этого были накопленные монеты – сразу отправляем их
  if (pendingMinedCoins > 0) {
    flushMinedCoins();
  }
  const savedUserId = localStorage.getItem('userId');
  if (savedUserId) {
    currentUserId = savedUserId;
    createUI();
    fetchUserData();
    updateUI();
  } else {
    openAuthModal();
  }
});

// При закрытии или обновлении страницы отправляем накопленные монеты синхронно
window.addEventListener('beforeunload', (event) => {
  if (pendingMinedCoins > 0) {
    flushMinedCoinsSync();
  }
});

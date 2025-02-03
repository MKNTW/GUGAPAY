const API_URL = "https://mkntw-github-io.onrender.com"; // Проверьте корректность URL
let currentUserId = null;
let pendingMinedCoins = parseFloat(localStorage.getItem('pendingMinedCoins')) || 0;
let mineTimer = null;
let localBalance = 0;
let updateInterval = null;

/* ================================
   ФУНКЦИИ РАБОТЫ С UI
   ================================ */

function logout() {
  localStorage.removeItem('userId');
  currentUserId = null;
  hideMainUI();
  closeAllModals();
  // Очищаем отображение ID
  document.getElementById('userIdDisplay').textContent = '';
  // Останавливаем автообновление баланса
  clearInterval(updateInterval);
  openAuthModal();
}

function updateTopBar() {
  const userIdDisplay = document.getElementById('userIdDisplay');
  userIdDisplay.textContent = currentUserId ? `ID: ${currentUserId}` : '';
}

function showMainUI() {
  document.getElementById('topBar').classList.remove('hidden');
  document.getElementById('balanceDisplay').classList.remove('hidden');
  document.getElementById('mineBtn').classList.remove('hidden');
  document.getElementById('bottomBar').classList.remove('hidden');
  // Запускаем автообновление баланса каждые 2 секунды
  updateInterval = setInterval(fetchUserData, 2000);
}

function hideMainUI() {
  document.getElementById('topBar').classList.add('hidden');
  document.getElementById('balanceDisplay').classList.add('hidden');
  document.getElementById('mineBtn').classList.add('hidden');
  document.getElementById('bottomBar').classList.add('hidden');
  clearInterval(updateInterval);
}

function closeAllModals() {
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => modal.classList.add('hidden'));
}

/**
 * Создаёт модальное окно и добавляет обработчик закрытия.
 * Если клик (или касание) происходит по оверлею (т.е. если e.target === контейнеру модального окна),
 * окно закрывается.
 */
function createModal(id, content) {
  let modal = document.getElementById(id);
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = id;
  modal.className = 'modal hidden';
  modal.innerHTML = `<div class="modal-content">${content}</div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal(id);
      fetchUserData();
    }
  });
  modal.addEventListener('touchend', (e) => {
    if (e.target === modal) {
      closeModal(id);
      fetchUserData();
    }
  });
  return modal;
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    fetchUserData();
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
  fetchUserData();
}

/* ------------------------------
   МОДАЛЬНОЕ ОКНО АВТОРИЗАЦИИ
------------------------------ */
function removeAuthModal() {
  const authModal = document.getElementById('authModal');
  if (authModal) authModal.remove();
}

function openLoginSection() {
  const loginSection = document.getElementById('loginSection');
  const registerSection = document.getElementById('registerSection');
  if (loginSection) loginSection.style.display = 'block';
  if (registerSection) registerSection.style.display = 'none';
}

function openRegisterSection() {
  const loginSection = document.getElementById('loginSection');
  const registerSection = document.getElementById('registerSection');
  if (loginSection) loginSection.style.display = 'none';
  if (registerSection) registerSection.style.display = 'block';
}

function openAuthModal() {
  hideMainUI();
  let authModal = document.getElementById('authModal');
  if (!authModal) {
    // В окне авторизации убираем надпись "GugaCoin"
    authModal = createModal('authModal', `
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

function formatBalance(balance) {
  return parseFloat(balance).toFixed(5);
}

/* ================================
   ФУНКЦИИ ДОБЫЧИ МОНЕТ
   ================================ */

function mineCoins() {
  if (!currentUserId) return;
  // При нажатии на кнопку "Майнить" останавливаем автообновление баланса
  clearInterval(updateInterval);
  
  pendingMinedCoins = parseFloat((pendingMinedCoins + 0.00001).toFixed(5));
  localStorage.setItem('pendingMinedCoins', pendingMinedCoins);
  localBalance = parseFloat((localBalance + 0.00001).toFixed(5));
  updateBalanceUI();
  
  if (mineTimer) clearTimeout(mineTimer);
  mineTimer = setTimeout(() => {
    flushMinedCoins();
    // Возобновляем автообновление баланса через 1 секунду после остановки кликов
    updateInterval = setInterval(fetchUserData, 2000);
  }, 1000);
}

function updateBalanceUI() {
  const balanceValue = document.getElementById('balanceValue');
  if (balanceValue) {
    balanceValue.textContent = formatBalance(localBalance);
  }
}

async function flushMinedCoins() {
  if (!currentUserId || pendingMinedCoins <= 0) return;
  try {
    const response = await fetch(`${API_URL}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUserId, amount: pendingMinedCoins })
    });
    if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
    pendingMinedCoins = 0;
    localStorage.removeItem('pendingMinedCoins');
    fetchUserData();
  } catch (error) {
    console.error('[FlushMinedCoins] Ошибка:', error);
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
    localStorage.removeItem('pendingMinedCoins');
  } catch (error) {
    console.error('[FlushMinedCoinsSync] Ошибка:', error);
  }
}

/* ================================
   ФУНКЦИИ РАБОТЫ С ПОЛЬЗОВАТЕЛЕМ И UI
   ================================ */

function createUI() {
  document.getElementById('transferBtn')?.addEventListener('click', openTransferModal);
  document.getElementById('historyBtn')?.addEventListener('click', openHistoryModal);
  document.getElementById('exchangeBtn')?.addEventListener('click', openExchangeModal);
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
}

function updateUI() {
  if (currentUserId) {
    updateTopBar();
    showMainUI();
    removeAuthModal();
  } else {
    hideMainUI();
    openAuthModal();
  }
}

async function fetchUserData() {
  try {
    const response = await fetch(`${API_URL}/user?userId=${currentUserId}`);
    if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
    const data = await response.json();
    if (data.success && data.user) {
      const balance = parseFloat(data.user.balance || 0);
      localBalance = balance;
      updateBalanceUI();
      updateExchangeModalInfo(data.user);
    } else {
      console.error('[Fetch User Data] Некорректный ответ сервера');
      localBalance = 0;
      updateBalanceUI();
    }
  } catch (error) {
    console.error('[Fetch User Data] Ошибка:', error.message);
    localBalance = 0;
    updateBalanceUI();
  }
}

/* ================================
   МОДАЛЬНЫЕ ОКНА: ПЕРЕВЕСТИ, ИСТОРИЯ, ОБМЕНЯТЬ
   ================================ */

function openTransferModal() {
  const modal = createModal('transferModal', `
    <h3>Перевести</h3>
    <label for="toUserIdInput">Кому (ID):</label>
    <input type="text" id="toUserIdInput" placeholder="Введите ID получателя">
    <label for="transferAmountInput">Количество:</label>
    <input type="number" id="transferAmountInput" step="0.00001" placeholder="Введите сумму">
    <button id="sendTransferBtn">Отправить</button>
  `);
  const sendTransferBtn = modal.querySelector('#sendTransferBtn');
  if (sendTransferBtn) {
    sendTransferBtn.addEventListener('click', async () => {
      await sendTransfer();
    });
  }
  openModal('transferModal');
}

async function sendTransfer() {
  const toUserId = document.getElementById('toUserIdInput')?.value;
  const amount = parseFloat(document.getElementById('transferAmountInput')?.value);
  if (!toUserId || !amount || amount <= 0) {
    alert('❌ Введите корректные данные');
    return;
  }
  if (toUserId === currentUserId) {
    alert('❌ Нельзя перевести самому себе');
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
      alert(`❌ Ошибка перевода: ${data.error || 'Неизвестная ошибка'}`);
    }
  } catch (error) {
    console.error(error);
    alert('🚫 Ошибка сети');
  }
}

function openHistoryModal() {
  const modal = createModal('historyModal', `
    <h3>История операций</h3>
    <div class="scrollable-content">
      <ul id="transactionList"></ul>
    </div>
  `);
  fetchTransactionHistory();
  openModal('historyModal');
}

async function fetchTransactionHistory() {
  try {
    const response = await fetch(`${API_URL}/transactions?userId=${currentUserId}`);
    if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
    const data = await response.json();
    if (data.success && data.transactions) {
      displayTransactionHistory(data.transactions);
    } else {
      console.error('[Fetch Transactions] Некорректный ответ сервера');
    }
  } catch (error) {
    console.error('[Fetch Transactions] Ошибка:', error.message);
  }
}

function displayTransactionHistory(transactions) {
  const transactionList = document.getElementById('transactionList');
  transactionList.innerHTML = '';
  if (transactions.length === 0) {
    transactionList.innerHTML = '<li>Нет операций</li>';
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
    transactionList.appendChild(li);
  });
}

function openExchangeModal() {
  const modal = createModal('exchangeModal', `
    <h3>Обменять</h3>
    <p id="exchangeRateInfo"></p>
    <p id="rubBalanceInfo"></p>
    <p id="halvingLevel"></p>
  `);
  // При открытии окна "Обменять" обновляем данные автоматически
  fetchUserData();
  openModal('exchangeModal');
}

function updateExchangeModalInfo(user) {
  const halvingStep = user.halvingStep || 0;
  const rubMultiplier = 1 + halvingStep * 0.02;
  const rubBalance = (localBalance * rubMultiplier).toFixed(2);
  const exchangeRateInfo = document.getElementById('exchangeRateInfo');
  const rubBalanceInfo = document.getElementById('rubBalanceInfo');
  const halvingLevel = document.getElementById('halvingLevel');
  if (exchangeRateInfo) {
    exchangeRateInfo.textContent = `Курс: 1 ₲ = ${rubMultiplier.toFixed(2)} ₽`;
  }
  if (rubBalanceInfo) {
    rubBalanceInfo.textContent = `Баланс: ${rubBalance} ₽`;
  }
  if (halvingLevel) {
    halvingLevel.textContent = `Уровень халвинга: ${halvingStep}`;
  }
}

async function register() {
  const loginVal = document.getElementById('regLogin')?.value;
  const password = document.getElementById('regPassword')?.value;
  if (!loginVal || !password) {
    alert('❌ Введите логин и пароль');
    return;
  }
  try {
    const response = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loginVal, password })
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

async function login() {
  const loginVal = document.getElementById('loginInput')?.value;
  const password = document.getElementById('passwordInput')?.value;
  if (!loginVal || !password) {
    alert('❌ Введите логин и пароль');
    return;
  }
  try {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loginVal, password })
    });
    const data = await response.json();
    if (data.success) {
      currentUserId = data.userId;
      localStorage.setItem('userId', currentUserId);
      createUI();
      updateUI();
      fetchUserData();
      alert(`✅ Успешный вход! Ваш ID: ${currentUserId}`);
    } else {
      alert(`❌ Ошибка входа: ${data.error}`);
    }
  } catch (error) {
    console.error(error);
    alert('🚫 Ошибка сети');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Автообновление баланса запускается только после успешного входа (showMainUI())
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

window.addEventListener('beforeunload', () => {
  if (pendingMinedCoins > 0) {
    flushMinedCoinsSync();
  }
});

document.getElementById('mineBtn')?.addEventListener('click', mineCoins);

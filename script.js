const API_URL = "https://mkntw-github-io.onrender.com"; // Убедитесь, что URL указан корректно
let currentUserId = null;

// Элементы интерфейса
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const userIdSpan = document.getElementById('userId');
const balanceSpan = document.getElementById('balance');
const transferBtn = document.getElementById('transferBtn');
const mineBtn = document.getElementById('mineBtn'); // Кнопка MINE
const historyBtn = document.getElementById('historyBtn'); // Кнопка Операции

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    const savedUserId = localStorage.getItem('userId');
    if (savedUserId) {
        currentUserId = savedUserId;
        updateUI();
        fetchUserData();
    } else {
        updateUI(); // Обновляем интерфейс при загрузке страницы
        openAuthModal(); // Открываем окно авторизации
    }

    // Привязка обработчиков событий
    if (loginBtn) loginBtn.addEventListener('click', openAuthModal);
    if (registerBtn) registerBtn.addEventListener('click', openAuthModal);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (transferBtn) transferBtn.addEventListener('click', openTransferModal); // Открываем окно перевода при нажатии на кнопку "Transfer"
    if (historyBtn) historyBtn.addEventListener('click', openHistoryModal); // Открываем окно истории операций при нажатии на кнопку "Операции"
    if (mineBtn) mineBtn.addEventListener('click', mineCoins); // Клик по кнопке MINE
});

// Обновление интерфейса
function updateUI() {
    if (currentUserId) {
        if (loginBtn) loginBtn.classList.add('hidden');
        if (registerBtn) registerBtn.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.remove('hidden');
        if (userInfo) userInfo.classList.remove('hidden');
        if (transferBtn) transferBtn.classList.remove('hidden');
        if (mineBtn) mineBtn.classList.remove('hidden'); // Показываем кнопку MINE
        if (historyBtn) historyBtn.classList.remove('hidden'); // Показываем кнопку Операции
        closeModal('authModal'); // Закрываем окно авторизации
    } else {
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (registerBtn) registerBtn.classList.remove('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');
        if (userInfo) userInfo.classList.add('hidden');
        if (transferBtn) transferBtn.classList.add('hidden');
        if (mineBtn) mineBtn.classList.add('hidden'); // Скрываем кнопку MINE
        if (historyBtn) historyBtn.classList.add('hidden'); // Скрываем кнопку Операции
        openAuthModal(); // Открываем окно авторизации
    }

    // Закрываем все модальные окна, кроме authModal, при загрузке страницы
    closeModal('transferModal');
    closeModal('historyModal');
}

// Функция для форматирования чисел
function formatBalance(balance) {
    return balance.toLocaleString('en-US'); // Добавляет разделители тысяч (например, 1,000,000)
}

// Создание модального окна
function createModal(id, content) {
    const modal = document.createElement('div');
    modal.id = id;
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            ${content}
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

// Открытие модального окна
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('hidden');
}

// Закрытие модального окна
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
}

// Открытие модального окна авторизации
function openAuthModal() {
    let authModal = document.getElementById('authModal');
    if (!authModal) {
        authModal = createModal('authModal', `
            <h3>Авторизация</h3>
            <div id="loginSection">
                <h4>Login</h4>
                <input type="text" id="loginInput" placeholder="Username">
                <input type="password" id="passwordInput" placeholder="Password">
                <button id="loginSubmitBtn">Login</button>
                <button id="switchToRegisterBtn">Register</button>
            </div>
            <div id="registerSection" style="display: none;">
                <h4>Register</h4>
                <input type="text" id="regLogin" placeholder="Username">
                <input type="password" id="regPassword" placeholder="Password">
                <button id="registerSubmitBtn">Register</button>
                <button id="switchToLoginBtn">Login</button>
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

    openLoginSection(); // По умолчанию открываем секцию входа
    openModal('authModal');
}

// Открытие секции входа
function openLoginSection() {
    const loginSection = document.getElementById('loginSection');
    const registerSection = document.getElementById('registerSection');
    if (loginSection) loginSection.style.display = 'block';
    if (registerSection) registerSection.style.display = 'none';
}

// Открытие секции регистрации
function openRegisterSection() {
    const loginSection = document.getElementById('loginSection');
    const registerSection = document.getElementById('registerSection');
    if (loginSection) loginSection.style.display = 'none';
    if (registerSection) registerSection.style.display = 'block';
}

// Регистрация
async function register() {
    const login = document.getElementById('regLogin').value;
    const password = document.getElementById('regPassword').value;

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
            localStorage.setItem('userId', currentUserId); // Сохраняем ID в localStorage
            updateUI();
            fetchUserData(); // Загружаем данные пользователя
        } else {
            alert(`❌ Ошибка регистрации: ${data.error}`);
        }
    } catch (error) {
        console.error(error);
        alert('🚫 Ошибка сети');
    }
}

// Авторизация
async function login() {
    const login = document.getElementById('loginInput').value;
    const password = document.getElementById('passwordInput').value;

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: login, password })
        });

        const data = await response.json();

        if (data.success) {
            currentUserId = data.userId;
            localStorage.setItem('userId', currentUserId); // Сохраняем ID в localStorage
            updateUI();
            fetchUserData(); // Загружаем данные пользователя
            closeModal('authModal'); // Закрываем окно авторизации
        } else {
            alert(`❌ Ошибка входа: ${data.error}`);
        }
    } catch (error) {
        console.error(error);
        alert('🚫 Ошибка сети');
    }
}

// Выход
function logout() {
    localStorage.removeItem('userId');
    currentUserId = null;
    updateUI();
}

// Получение данных пользователя
async function fetchUserData() {
    try {
        const response = await fetch(`${API_URL}/user?userId=${currentUserId}`);
        if (!response.ok) {
            throw new Error(`Server responded with status ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.user) {
            const balance = data.user.balance || 0; // Баланс в минимальных единицах

            // Проверка, что balance является числом
            if (typeof balance === 'number') {
                if (userIdSpan) userIdSpan.textContent = currentUserId;
                if (balanceSpan) balanceSpan.textContent = formatBalance(balance); // Отображаем баланс в удобном формате
            } else {
                console.error('[Fetch User Data] Error: Balance is not a number');
                if (balanceSpan) balanceSpan.textContent = '0'; // Устанавливаем значение по умолчанию
            }
        } else {
            console.error('[Fetch User Data] Error: Invalid response from server');
            if (balanceSpan) balanceSpan.textContent = '0'; // Устанавливаем значение по умолчанию
        }
    } catch (error) {
        console.error('[Fetch User Data] Error:', error.message);
        if (balanceSpan) balanceSpan.textContent = '0'; // Устанавливаем значение по умолчанию
    }
}

// Открытие модального окна перевода
function openTransferModal() {
    if (!currentUserId) return;

    let transferModal = document.getElementById('transferModal');
    if (!transferModal) {
        transferModal = createModal('transferModal', `
            <h3>Перевод монет</h3>
            <label for="toUserIdInput">Кому (ID пользователя):</label>
            <input type="text" id="toUserIdInput" placeholder="Введите ID получателя">
            <label for="transferAmountInput">Количество:</label>
            <input type="number" id="transferAmountInput" placeholder="Введите сумму">
            <button id="sendTransferBtn">Отправить</button>
            <button class="close-btn">X</button>
        `);

        const closeTransferBtn = transferModal.querySelector('.close-btn');
        const sendTransferBtn = transferModal.querySelector('#sendTransferBtn');

        if (closeTransferBtn) closeTransferBtn.addEventListener('click', () => closeModal('transferModal'));
        if (sendTransferBtn) sendTransferBtn.addEventListener('click', sendTransfer);
    }

    openModal('transferModal');
}

// Перевод монет
async function sendTransfer() {
    const toUserId = document.getElementById('toUserIdInput').value;
    const amount = parseInt(document.getElementById('transferAmountInput').value, 10);

    // Проверяем, что данные введены корректно
    if (!toUserId || !amount || amount <= 0) {
        alert('❌ Введите корректные данные');
        return;
    }

    // Запрещаем перевод самому себе
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

// Открытие модального окна истории операций
function openHistoryModal() {
    if (!currentUserId) return;

    let historyModal = document.getElementById('historyModal');
    if (!historyModal) {
        historyModal = createModal('historyModal', `
            <h3>История операций</h3>
            <ul id="transactionList"></ul>
            <button class="close-btn">X</button>
        `);

        const closeHistoryBtn = historyModal.querySelector('.close-btn');

        if (closeHistoryBtn) closeHistoryBtn.addEventListener('click', () => closeModal('historyModal'));
    }

    fetchTransactionHistory();
    openModal('historyModal');
}

// Получение истории операций
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

// Отображение истории операций
function displayTransactionHistory(transactions) {
    const transactionList = document.getElementById('transactionList');
    if (transactionList) transactionList.innerHTML = ''; // Очищаем список

    if (transactions.length === 0) {
        if (transactionList) transactionList.innerHTML = '<li>Нет операций</li>';
        return;
    }

    transactions.forEach(tx => {
        const li = document.createElement('li');
        const date = new Date(tx.created_at).toLocaleString(); // Форматируем дату
        const amount = formatBalance(tx.amount);

        if (tx.type === 'sent') {
            li.textContent = `Переведено: ${amount} монет пользователю ${tx.to_user_id} (${date})`;
        } else {
            li.textContent = `Получено: ${amount} монет от пользователя ${tx.from_user_id} (${date})`;
        }

        if (transactionList) transactionList.appendChild(li);
    });
}

// Обработка клика по кнопке MINE
async function mineCoins() {
    if (!currentUserId) return;

    try {
        const response = await fetch(`${API_URL}/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId })
        });

        if (!response.ok) {
            throw new Error(`Server responded with status ${response.status}`);
        }

        // Обновляем данные пользователя
        fetchUserData();
    } catch (error) {
        console.error(error);
        alert('🚫 Ошибка при попытке добыть монеты');
    }
}

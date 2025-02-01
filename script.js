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

// Модальные окна
const registerModal = document.getElementById('registerModal');
const loginModal = document.getElementById('loginModal');
const transferModal = document.getElementById('transferModal');

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    const savedUserId = localStorage.getItem('userId');
    if (savedUserId) {
        currentUserId = savedUserId;
        updateUI();
        fetchUserData();
    } else {
        updateUI(); // Обновляем интерфейс при загрузке страницы
    }
});

// Обновление интерфейса
function updateUI() {
    if (currentUserId) {
        loginBtn.classList.add('hidden');
        registerBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
        userInfo.classList.remove('hidden');
        transferBtn.classList.remove('hidden');
        mineBtn.classList.remove('hidden'); // Показываем кнопку MINE
    } else {
        loginBtn.classList.remove('hidden');
        registerBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
        userInfo.classList.add('hidden');
        transferBtn.classList.add('hidden');
        mineBtn.classList.add('hidden'); // Скрываем кнопку MINE
    }
}

// Функция для форматирования чисел
function formatBalance(balance) {
    return balance.toLocaleString('en-US'); // Добавляет разделители тысяч (например, 1,000,000)
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
            closeModals();
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
            closeModals();
            fetchUserData(); // Загружаем данные пользователя
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
    closeModals();
}

// Перевод монет
async function transferCoins() {
    const toUserId = document.getElementById('toUserId').value;
    const amount = parseInt(document.getElementById('transferAmount').value, 10);

    if (!toUserId || !amount || amount <= 0) {
        alert('❌ Введите корректные данные');
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
            closeModals();
            fetchUserData();
        } else {
            alert(`❌ Ошибка перевода: ${data.error}`);
        }
    } catch (error) {
        console.error(error);
        alert('🚫 Ошибка сети');
    }
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
                userIdSpan.textContent = currentUserId;
                balanceSpan.textContent = formatBalance(balance); // Отображаем баланс в удобном формате
            } else {
                console.error('[Fetch User Data] Error: Balance is not a number');
                balanceSpan.textContent = '0'; // Устанавливаем значение по умолчанию
            }
        } else {
            console.error('[Fetch User Data] Error: Invalid response from server');
            balanceSpan.textContent = '0'; // Устанавливаем значение по умолчанию
        }
    } catch (error) {
        console.error('[Fetch User Data] Error:', error.message);
        balanceSpan.textContent = '0'; // Устанавливаем значение по умолчанию
    }
}

// Клик по кнопке MINE
mineBtn.addEventListener('click', async () => {
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
});

// Закрытие модальных окон
function closeModals() {
    registerModal.classList.add('hidden');
    loginModal.classList.add('hidden');
    transferModal.classList.add('hidden');
}

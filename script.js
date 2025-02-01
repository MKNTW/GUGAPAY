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

// Модальные окна
const registerModal = document.getElementById('registerModal');
const loginModal = document.getElementById('loginModal');
const transferModal = document.getElementById('transferModal');
const historyModal = document.getElementById('historyModal'); // Модальное окно истории
const transactionList = document.getElementById('transactionList'); // Список транзакций
const closeHistoryBtn = document.getElementById('closeHistoryBtn'); // Кнопка закрытия истории

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

    // Привязка обработчиков событий
    loginBtn.addEventListener('click', () => {
        closeModals(); // Закрываем все модальные окна
        loginModal.classList.remove('hidden'); // Открываем окно входа
    });
    registerBtn.addEventListener('click', () => {
        closeModals(); // Закрываем все модальные окна
        registerModal.classList.remove('hidden'); // Открываем окно регистрации
    });
    logoutBtn.addEventListener('click', logout);
    transferBtn.addEventListener('click', () => {
        closeModals(); // Закрываем все модальные окна
        transferModal.classList.remove('hidden'); // Открываем окно перевода
    });
    historyBtn.addEventListener('click', openHistoryModal); // Открываем окно истории операций
    closeHistoryBtn.addEventListener('click', closeHistoryModal); // Закрываем окно истории

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
        historyBtn.classList.remove('hidden'); // Показываем кнопку Операции
    } else {
        loginBtn.classList.remove('hidden');
        registerBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
        userInfo.classList.add('hidden');
        transferBtn.classList.add('hidden');
        mineBtn.classList.add('hidden'); // Скрываем кнопку MINE
        historyBtn.classList.add('hidden'); // Скрываем кнопку Операции
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

// Открытие модального окна истории
function openHistoryModal() {
    if (!currentUserId) return;

    fetchTransactionHistory();
    historyModal.classList.remove('hidden');
}

// Закрытие модального окна истории
function closeHistoryModal() {
    historyModal.classList.add('hidden');
    transactionList.innerHTML = ''; // Очищаем список транзакций
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
    transactionList.innerHTML = ''; // Очищаем список

    if (transactions.length === 0) {
        transactionList.innerHTML = '<li>Нет операций</li>';
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

        transactionList.appendChild(li);
    });
}

// Закрытие модальных окон
function closeModals() {
    registerModal.classList.add('hidden');
    loginModal.classList.add('hidden');
    transferModal.classList.add('hidden');
    historyModal.classList.add('hidden');
}

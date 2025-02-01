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

// Кнопки закрытия модальных окон
const closeRegisterBtn = document.getElementById('closeRegisterBtn');
const closeLoginBtn = document.getElementById('closeLoginBtn');
const closeTransferBtn = document.getElementById('closeTransferBtn'); // Кнопка закрытия перевода
const closeHistoryBtn = document.getElementById('closeHistoryBtn'); // Кнопка закрытия истории

// Кнопки отправки модальных окон
const registerSubmitBtn = document.getElementById('registerSubmitBtn'); // Кнопка отправки регистрации
const loginSubmitBtn = document.getElementById('loginSubmitBtn'); // Кнопка отправки входа
const sendTransferBtn = document.getElementById('sendTransferBtn'); // Кнопка отправки перевода

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
    if (loginBtn) loginBtn.addEventListener('click', openLoginModal);
    if (registerBtn) registerBtn.addEventListener('click', openRegisterModal);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (transferBtn) transferBtn.addEventListener('click', openTransferModal); // Открываем окно перевода при нажатии на кнопку "Transfer"
    if (historyBtn) historyBtn.addEventListener('click', openHistoryModal); // Открываем окно истории операций при нажатии на кнопку "Операции"
    if (closeRegisterBtn) closeRegisterBtn.addEventListener('click', closeRegisterModal);
    if (closeLoginBtn) closeLoginBtn.addEventListener('click', closeLoginModal);
    if (closeTransferBtn) closeTransferBtn.addEventListener('click', closeTransferModal); // Закрываем окно перевода
    if (closeHistoryBtn) closeHistoryBtn.addEventListener('click', closeHistoryModal); // Закрываем окно истории
    if (registerSubmitBtn) registerSubmitBtn.addEventListener('click', register); // Отправляем регистрацию
    if (loginSubmitBtn) loginSubmitBtn.addEventListener('click', login); // Отправляем вход
    if (sendTransferBtn) sendTransferBtn.addEventListener('click', sendTransfer); // Отправляем перевод
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
    } else {
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (registerBtn) registerBtn.classList.remove('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');
        if (userInfo) userInfo.classList.add('hidden');
        if (transferBtn) transferBtn.classList.add('hidden');
        if (mineBtn) mineBtn.classList.add('hidden'); // Скрываем кнопку MINE
        if (historyBtn) historyBtn.classList.add('hidden'); // Скрываем кнопку Операции
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
            closeRegisterModal();
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
            closeLoginModal();
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

// Открытие модального окна регистрации
function openRegisterModal() {
    closeModals(); // Закрываем все модальные окна
    if (registerModal) registerModal.classList.remove('hidden'); // Открываем окно регистрации
}

// Закрытие модального окна регистрации
function closeRegisterModal() {
    if (registerModal) registerModal.classList.add('hidden');
}

// Открытие модального окна входа
function openLoginModal() {
    closeModals(); // Закрываем все модальные окна
    if (loginModal) loginModal.classList.remove('hidden'); // Открываем окно входа
}

// Закрытие модального окна входа
function closeLoginModal() {
    if (loginModal) loginModal.classList.add('hidden');
}

// Открытие модального окна перевода
function openTransferModal() {
    if (!currentUserId) return;

    closeModals(); // Закрываем все модальные окна
    if (transferModal) transferModal.classList.remove('hidden'); // Открываем окно перевода
}

// Закрытие модального окна перевода
function closeTransferModal() {
    if (transferModal) transferModal.classList.add('hidden');
}

// Открытие модального окна истории операций
function openHistoryModal() {
    if (!currentUserId) return;

    fetchTransactionHistory();
    closeModals(); // Закрываем все модальные окна
    if (historyModal) historyModal.classList.remove('hidden'); // Открываем окно истории
}

// Закрытие модального окна истории операций
function closeHistoryModal() {
    if (historyModal) historyModal.classList.add('hidden');
    if (transactionList) transactionList.innerHTML = ''; // Очищаем список транзакций
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
            closeTransferModal();
            fetchUserData();
        } else {
            alert(`❌ Ошибка перевода: ${data.error}`);
        }
    } catch (error) {
        console.error(error);
        alert('🚫 Ошибка сети');
    }
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

// Закрытие всех модальных окон
function closeModals() {
    if (registerModal) registerModal.classList.add('hidden');
    if (loginModal) loginModal.classList.add('hidden');
    if (transferModal) transferModal.classList.add('hidden');
    if (historyModal) historyModal.classList.add('hidden');
}

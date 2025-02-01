const API_URL = "https://mkntw-github-io.onrender.com"; // Убедитесь, что URL указан корректно
let currentUserId = null;

// Элементы интерфейса
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const userIdSpan = document.getElementById('userId');
const balanceSpan = document.getElementById('balance');
const transferBtn = document.getElementById('transferBtn');
const historyBtn = document.getElementById('historyBtn');
const mineBtn = document.getElementById('mineBtn'); // Кнопка майнить (изображение)

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    const savedUserId = localStorage.getItem('userId');
    if (savedUserId) {
        currentUserId = savedUserId;
        updateUI();
        fetchUserData();
    } else {
        openAuthModal(); // Открываем окно авторизации
    }

    // Привязка обработчиков событий
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (transferBtn) transferBtn.addEventListener('click', openTransferModal); // Открываем окно перевода
    if (historyBtn) historyBtn.addEventListener('click', openHistoryModal); // Открываем окно истории операций
    if (mineBtn) mineBtn.addEventListener('click', mineCoins); // Клик по кнопке майнить
});

// Обновление интерфейса
function updateUI() {
    if (currentUserId) {
        // Пользователь вошёл в систему
        if (logoutBtn) logoutBtn.classList.remove('hidden');
        if (userInfo) userInfo.classList.remove('hidden');
        removeAuthModal(); // Удаляем окно авторизации из DOM
    } else {
        // Пользователь не вошёл в систему
        if (logoutBtn) logoutBtn.classList.add('hidden');
        if (userInfo) userInfo.classList.add('hidden');
        openAuthModal(); // Открываем окно авторизации
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

// Функция для форматирования чисел
function formatBalance(balance) {
    return balance.toLocaleString('en-US'); // Добавляет разделители тысяч (например, 1,000,000)
}

// Обработка клика по кнопке майнить
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
        alert('✅ Баланс увеличен!'); // Уведомление о добыче
    } catch (error) {
        console.error(error);
        alert('🚫 Ошибка при попытке добыть монеты');
    }
}

// Выход
function logout() {
    localStorage.removeItem('userId');
    currentUserId = null;
    updateUI();
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

// Удаление модального окна из DOM
function removeAuthModal() {
    const authModal = document.getElementById('authModal');
    if (authModal) authModal.remove(); // Удаляем окно из DOM
}

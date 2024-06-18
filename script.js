// Function to retrieve ZCOIN from local storage
function getCoinsFromStorage() {
    return parseFloat(localStorage.getItem('coins')) || 0;
}

// Function to save ZCOIN to local storage
function saveCoinsToStorage(coins) {
    localStorage.setItem('coins', coins.toString());
}

// Функция для отправки данных в Telegram бота
function sendCoinsToTelegram(coins) {
    // Предположим, что tg.sendData отправляет данные в Telegram
    tg.sendData({ coins: coins.toFixed(5) });
}

// Функция для обновления ID пользователя на экране
function updateUserId(userId) {
    let usercard = document.getElementById("usercard");
    let p = document.createElement("p");
    p.innerText = `Ваш ID: ${userId}`;
    usercard.appendChild(p);
}

// Обработчик клика по кнопке "Отправить монеты в Telegram"
document.getElementById('sendCoinsBtn').addEventListener('click', function() {
    sendCoinsToTelegram(coins);
});

// Предположим, что в Telegram.WebApp.onEvent можно добавить обработчик события
Telegram.WebApp.onEvent("mainButtonClicked", function() {
    sendCoinsToTelegram(coins);
});

// Предположим, что у нас есть доступ к ID пользователя через tg.initDataUnsafe.user.id
let userId = tg.initDataUnsafe.user.id;
updateUserId(userId);

// Измененная часть для работы с монетами и Local Storage

let coins = getCoinsFromStorage();
document.getElementById('coins').innerText = `ZCOIN: ${coins.toFixed(5)}`;

document.getElementById('tapArea').addEventListener('click', function() {
    coins += 0.00001;
    document.getElementById('coins').innerText = `ZCOIN: ${coins.toFixed(5)}`;
    saveCoinsToStorage(coins);

    // Button press animation
    this.style.transform = 'scale(0.95)';
    setTimeout(() => {
        this.style.transform = 'scale(1)';
    }, 50);
});

// On page load, update coins from storage
window.onload = function() {
    coins = getCoinsFromStorage();
    document.getElementById('coins').innerText = `ZCOIN: ${coins.toFixed(5)}`;
};

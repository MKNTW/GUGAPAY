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

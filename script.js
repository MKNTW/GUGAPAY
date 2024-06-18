// Функция для отправки данных в Telegram бота
function sendCoinsToTelegram(coins) {
    // Предположим, что tg.sendData отправляет данные в Telegram
    tg.sendData({ coins: coins.toFixed(5) });
}

// Обработчик клика по кнопке "Отправить монеты в Telegram"
document.getElementById('sendCoinsBtn').addEventListener('click', function() {
    sendCoinsToTelegram(coins);
});

// Функция для обновления ID пользователя на экране
function updateUserId(userId) {
    document.getElementById('userIdValue').textContent = userId;
}

// Предположим, что в Telegram. WebApp. onEvent можно добавить обработчик события
Telegram.WebApp.onEvent("mainButtonClicked", function() {
    sendCoinsToTelegram(coins);
});

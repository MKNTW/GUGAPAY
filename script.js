// Функция для извлечения ZCOIN из локального хранилища
function getCoinsFromStorage() {
    return parseFloat(localStorage.getItem('coins')) || 0;
}

// Функция для сохранения ZCOIN в локальное хранилище
function saveCoinsToStorage(coins) {
    localStorage.setItem('coins', coins.toString());
}

// Переменные для работы с монетами, тапами и временем
let coins = getCoinsFromStorage();

// Устанавливаем начальное значение ZCOIN
document.getElementById('coins').innerText = `ZCOIN: ${coins.toFixed(5)}`;

// Добавляем слушателя события на кнопку для тапа
document.getElementById('tapArea').addEventListener('click', function(event) {
    // Проверяем, достигнут ли лимит тапов и нужно ли его сбросить
    if (tapCount >= tapLimit && !isTapLimitResetNeeded()) {
        alert('Вы достигли лимита тапов на этот период. Пожалуйста, подождите до сброса лимита.');
        return;
    }

    // Увеличиваем количество монет и сохраняем в локальное хранилище
    coins += 0.00001;
    document.getElementById('coins').innerText = `ZCOIN: ${coins.toFixed(5)}`;
    saveCoinsToStorage(coins);

    // Создаем элемент для отображения текста +0.0001
    const tapFeedback = document.createElement('div');
    tapFeedback.textContent = '+0.00001';
    tapFeedback.classList.add('tap-feedback');
    this.appendChild(tapFeedback);

    // Анимация появления и исчезновения текста
    setTimeout(() => {
        tapFeedback.style.animation = 'tapFeedbackAnimation 1s forwards';
    }, 50);

    // Удаляем элемент после завершения анимации
    setTimeout(() => {
        tapFeedback.remove();
    }, 1050);

    // Анимация нажатия кнопки
    this.style.transform = 'scale(0.95)';
    setTimeout(() => {
        this.style.transform = 'scale(1)';
    }, 50);

    // Предотвращаем всплытие события клика
    event.stopPropagation();
});

// Загрузка страницы: обновляем количество монет и информацию о лимите на тапы
window.onload = function() {
    coins = getCoinsFromStorage();
    document.getElementById('coins').innerText = `ZCOIN: ${coins.toFixed(5)}`;
};

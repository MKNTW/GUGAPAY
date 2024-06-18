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
let tapCount = parseInt(localStorage.getItem('tapCount')) || 0;
let lastTapTime = parseInt(localStorage.getItem('lastTapTime')) || 0;

// Константы для лимита тапов, времени и начисления за бездействие
const tapLimit = 1000;
const tapInterval = 1800000; // 30 минут в миллисекундах
const idleReward = 200;
const idleRewardInterval = 1800000; // 30 минут в миллисекундах

// Обновление информации о лимите на тапы и времени до обновления
updateTapLimitInfo();

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
    coins += 0.0001;
    document.getElementById('coins').innerText = `ZCOIN: ${coins.toFixed(5)}`;
    saveCoinsToStorage(coins);

    // Увеличиваем количество тапов и сохраняем в локальное хранилище
    tapCount++;
    localStorage.setItem('tapCount', tapCount.toString());

    // Обновляем информацию о лимите на тапы
    updateTapLimitInfo();

    // Создаем элемент для отображения текста +0.0001
    const tapFeedback = document.createElement('div');
    tapFeedback.textContent = '+0.0001';
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

    updateTapLimitInfo();

    // Запускаем таймер для обновления баланса через каждые 30 минут
    setInterval(() => {
        if (isTapLimitResetNeeded()) {
            // Сбрасываем лимит тапов
            tapCount = 0;
            localStorage.setItem('tapCount', '0');
            localStorage.setItem('lastTapTime', Date.now().toString());
            updateTapLimitInfo();
        } else {
            // Начисляем бонус за бездействие, если лимит уже достигнут
            coins += idleReward;
            saveCoinsToStorage(coins);
            document.getElementById('coins').innerText = `ZCOIN: ${coins.toFixed(5)}`;
        }
    }, idleRewardInterval);

    // Обновляем время до обновления каждую секунду
    setInterval(updateRefreshTime, 1000);
};

// Функция для обновления информации о лимите на тапы
function updateTapLimitInfo() {
    const tapLimitProgress = document.getElementById('tapLimitProgress');
    tapLimitProgress.innerHTML = ''; // Очищаем прогресс-бар

    const tapLimitProgressFill = document.createElement('div');
    tapLimitProgressFill.id = 'tapLimitProgressFill';
    tapLimitProgress.appendChild(tapLimitProgressFill);

    const tapLimitText = document.getElementById('tapLimitText');
    tapLimitText.textContent = `${tapCount}/${tapLimit}`;

    updateRefreshTime(); // Обновляем время до обновления
}

// Функция для обновления времени до обновления
function updateRefreshTime() {
    const currentTime = Date.now();
    const timeDifference = tapInterval - (currentTime - lastTapTime);

    const minutes = Math.floor(timeDifference / 60000);
    const seconds = Math.floor((timeDifference % 60000) / 1000);

    const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('tapRefreshTime').textContent = `Time until refresh: ${formattedTime}`;
}

// Функция для проверки, нужно ли сбросить лимит тапов
function isTapLimitResetNeeded() {
    if (tapCount >= tapLimit) {
        const currentTime = Date.now();
        return (currentTime - lastTapTime) >= tapInterval;
    }
    return false;
}

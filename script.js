// Function to retrieve ZCOIN from local storage
function getCoinsFromStorage() {
    return parseFloat(localStorage.getItem('coins')) || 0;
}

// Function to save ZCOIN to local storage
function saveCoinsToStorage(coins) {
    localStorage.setItem('coins', coins.toString());
}

// Измененная часть для работы с монетами и Local Storage

let coins = getCoinsFromStorage();
document.getElementById('coins').innerText = `ZCOIN: ${coins.toFixed(5)}`;

document.getElementById('tapArea').addEventListener('click', function(event) {
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

// При загрузке страницы обновляем количество монет из хранилища
window.onload = function() {
    coins = getCoinsFromStorage();
    document.getElementById('coins').innerText = `ZCOIN: ${coins.toFixed(5)}`;
};

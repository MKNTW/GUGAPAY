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
document.getElementById('coins').innerText = ` ${coins.toFixed(5)}`;

document.getElementById('tapArea').addEventListener('click', function(event) {
    coins += 0.00001;
    document.getElementById('coins').innerText = ` ${coins.toFixed(5)}`;
    saveCoinsToStorage(coins);

    const tapFeedback = document.createElement('div');
    tapFeedback.textContent = '+0.00001';
    tapFeedback.classList.add('tap-feedback');

    // Установка позиции на основе координат клика
    tapFeedback.style.left = `${event.clientX}px`;
    tapFeedback.style.top = `${event.clientY}px`;

    document.body.appendChild(tapFeedback);

    setTimeout(() => {
        tapFeedback.style.animation = 'tapFeedbackAnimation 1s forwards';
    }, 50);

    setTimeout(() => {
        tapFeedback.remove();
    }, 1050);

    this.style.transform = 'scale(0.95)';
    setTimeout(() => {
        this.style.transform = 'scale(1)';
    }, 50);

    event.stopPropagation();
});

// При загрузке страницы обновляем количество монет из хранилища
window.onload = function() {
    coins = getCoinsFromStorage();
    document.getElementById('coins').innerText = ` ${coins.toFixed(5)}`;
};

// Инициализация TonConnect
const tonConnect = new TonConnect();

// Создание кнопки подключения
const connectButton = document.createElement('button');
connectButton.innerText = 'Connect Ton Wallet';
connectButton.classList.add('connect-button');
connectButton.addEventListener('click', async () => {
    try {
        await tonConnect.connect();
        alert('Connected successfully!');
        // Дополнительные действия после успешного подключения
    } catch (error) {
        console.error('Connection failed', error);
        alert('Connection failed');
    }
});

document.getElementById('connect').appendChild(connectButton);

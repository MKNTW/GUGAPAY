// Function to retrieve ZCOIN from local storage
function getCoinsFromStorage() {
    return parseFloat(localStorage.getItem('coins')) || 0;
}

// Function to save ZCOIN to local storage
function saveCoinsToStorage(coins) {
    localStorage.setItem('coins', coins.toString());
}

// Function to add coins and display feedback
function addCoins(amount, x, y) {
    coins += amount;
    document.getElementById('coins').innerText = ` ${coins.toFixed(5)}`;
    saveCoinsToStorage(coins);

    const tapFeedback = document.createElement('div');
    tapFeedback.textContent = `+${amount.toFixed(5)}`;
    tapFeedback.classList.add('tap-feedback');

    // Set position based on click/touch coordinates
    tapFeedback.style.left = `${x}px`;
    tapFeedback.style.top = `${y}px`;

    document.body.appendChild(tapFeedback);

    setTimeout(() => {
        tapFeedback.style.animation = 'tapFeedbackAnimation 1s forwards';
    }, 50);

    setTimeout(() => {
        tapFeedback.remove();
    }, 1050);
}

// Handler for tap events
function handleTap(event) {
    const amount = 0.00001;
    const x = event.clientX || (event.touches && event.touches[0].clientX);
    const y = event.clientY || (event.touches && event.touches[0].clientY);

    addCoins(amount, x, y);

    event.target.style.transform = 'scale(0.95)';
    setTimeout(() => {
        event.target.style.transform = 'scale(1)';
    }, 50);

    event.stopPropagation();
}

// Handler for touch events
function handleTouch(event) {
    Array.from(event.touches).forEach(touch => {
        handleTap(touch);
    });
}

const tapArea = document.getElementById('tapArea');
tapArea.addEventListener('click', handleTap);
tapArea.addEventListener('touchstart', handleTouch);

// Initialize coins from storage on page load
window.onload = function() {
    coins = getCoinsFromStorage();
    document.getElementById('coins').innerText = ` ${coins.toFixed(5)}`;
};

// Initialize TonConnect
const tonConnect = new TonConnect();

// Create connect button
const connectButton = document.createElement('button');
connectButton.innerText = 'Connect Ton Wallet';
connectButton.classList.add('connect-button');
connectButton.addEventListener('click', async () => {
    try {
        await tonConnect.connect();
        alert('Connected successfully!');
        // Additional actions after successful connection
    } catch (error) {
        console.error('Connection failed', error);
        alert('Connection failed');
    }
});

document.getElementById('connect').appendChild(connectButton);

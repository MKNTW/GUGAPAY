// Function to retrieve ZCOIN from local storage
function getCoinsFromStorage() {
    return parseFloat(localStorage.getItem('coins')) || 0;
}

// Function to save ZCOIN to local storage
function saveCoinsToStorage(coins) {
    localStorage.setItem('coins', coins.toString());
}

// Function to save wallet name to local storage
function saveWalletName(name) {
    localStorage.setItem('walletName', name);
}

// Function to get wallet name from local storage
function getWalletName() {
    return localStorage.getItem('walletName') || '';
}

let coins = getCoinsFromStorage();
document.getElementById('coins').innerText = `ZCOIN: ${coins.toFixed(5)}`;

// Update wallet display if already stored
document.getElementById('walletDisplay').innerText = `Кошелек: ${getWalletName()}`;

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

// Save wallet name on button click
document.getElementById('confirmWalletBtn').addEventListener('click', function() {
    const walletName = document.getElementById('walletNameInput').value.trim();
    if (walletName !== '') {
        saveWalletName(walletName);
        document.getElementById('walletDisplay').innerText = `Кошелек: ${walletName}`;
        document.getElementById('walletNameInput').value = ''; // Clear input field
    }
});

// Function to retrieve Ton wallet from local storage
function getTonWalletFromStorage() {
    return localStorage.getItem('tonWallet') || '';
}

// Function to save Ton wallet to local storage
function saveTonWalletToStorage(wallet) {
    localStorage.setItem('tonWallet', wallet);
}

// Display Ton wallet on page load
window.onload = function() {
    const storedWallet = getTonWalletFromStorage();
    if (storedWallet) {
        displayTonWallet(storedWallet);
    }
};

// Function to display Ton wallet
function displayTonWallet(wallet) {
    const walletDisplay = document.getElementById('walletDisplay');
    walletDisplay.innerText = `Кошелек: ${wallet}`;
}

// Event listener for input field
const walletInputField = document.getElementById('walletInputField');
walletInputField.addEventListener('change', function() {
    const wallet = this.value.trim();
    saveTonWalletToStorage(wallet);
    displayTonWallet(wallet);
    this.value = ''; // Clear input field after saving
});

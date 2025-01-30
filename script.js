import { TonConnect } from '@tonconnect/sdk';

// Указываем URL манифеста с вашего GitHub Pages
const connector = new TonConnect({
    manifestUrl: 'https://mkntw.github.io/tonconnect-manifest.json'
});

// Элементы интерфейса
const connectButton = document.getElementById('connect-button');
const mineButton = document.getElementById('mine-button');
const balanceElement = document.getElementById('balance');
const walletInfo = document.getElementById('wallet-info');

let userAddress = null;
let balance = 0;

// Инициализация приложения
async function init() {
    // Восстановление сессии
    if (connector.connected) {
        await handleWalletConnect();
    }
    
    // Подписка на изменения состояния
    connector.onStatusChange(wallet => {
        if (wallet) {
            handleWalletConnect(wallet);
        } else {
            handleWalletDisconnect();
        }
    });
}

// Обработчик подключения кошелька
async function handleWalletConnect(wallet) {
    try {
        userAddress = wallet.account.address;
        
        // Обновление UI
        connectButton.textContent = `Connected: ${shortAddress(userAddress)}`;
        walletInfo.textContent = `Wallet: ${wallet.device.appName}`;
        
        // Загрузка баланса
        await loadBalance();
        
        console.log('Wallet connected:', wallet);
    } catch (error) {
        console.error('Connection error:', error);
    }
}

// Обработчик отключения кошелька
function handleWalletDisconnect() {
    userAddress = null;
    balance = 0;
    connectButton.textContent = 'Connect Wallet';
    walletInfo.textContent = '';
    updateBalance();
}

// Загрузка баланса с сервера
async function loadBalance() {
    if (!userAddress) return;
    
    try {
        // Используем серверный URL для запроса баланса
        const response = await fetch(`https://silver-buses-burn.loca.lt/balance?address=${userAddress}`);
        const data = await response.json();
        balance = data.balance || 0;
        updateBalance();
    } catch (error) {
        console.error('Balance load error:', error);
    }
}

// Обновление баланса
function updateBalance() {
    balanceElement.textContent = balance.toFixed(5);
}

// Обработчик майнинга
mineButton.addEventListener('click', async () => {
    if (!userAddress) {
        alert('Please connect wallet first!');
        return;
    }
    
    try {
        // Отправка транзакции
        const transaction = {
            messages: [
                {
                    address: userAddress,
                    amount: '1000000' // 0.001 TON
                }
            ]
        };
        
        // Подписание транзакции
        const result = await connector.sendTransaction(transaction);
        
        // Обновление баланса
        balance += 0.001;
        updateBalance();
        
        console.log('Transaction successful:', result);
    } catch (error) {
        console.error('Mining error:', error);
    }
});

// Вспомогательные функции
function shortAddress(address) {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', init);

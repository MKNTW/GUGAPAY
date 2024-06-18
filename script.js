document.getElementById('register').addEventListener('click', async () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if (response.ok) {
        alert('Registered successfully');
    } else {
        alert('Registration failed');
    }
});

document.getElementById('login').addEventListener('click', async () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    if (response.ok) {
        localStorage.setItem('token', data.token);
        document.getElementById('auth').style.display = 'none';
        document.getElementById('game').style.display = 'block';
        loadCoins();
    } else {
        alert('Login failed');
    }
});

async function loadCoins() {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/coins', {
        headers: { 'x-auth-token': token }
    });
    const data = await response.json();
    if (response.ok) {
        document.getElementById('coins').innerText = `ZCOIN: ${data.coins.toFixed(5)}`;
    } else {
        alert('Failed to load coins');
    }
}

document.getElementById('tapArea').addEventListener('click', async () => {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/tap', {
        method: 'POST',
        headers: { 'x-auth-token': token }
    });
    const data = await response.json();
    if (response.ok) {
        document.getElementById('coins').innerText = `ZCOIN: ${data.coins.toFixed(5)}`;
    } else {
        alert('Failed to update coins');
    }
});

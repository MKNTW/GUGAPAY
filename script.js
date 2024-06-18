// Пример хранения пользователей и их состояния в игре без серверной базы данных

// Объект для хранения пользователей
let users = [];

// Функция для регистрации нового пользователя
function registerUser(username, password) {
    // Проверяем, что пользователь с таким именем не существует
    const existingUser = users.find(user => user.username === username);
    if (existingUser) {
        return false; // Пользователь уже существует
    }

    // Создаем нового пользователя и добавляем в список
    const newUser = {
        username,
        password,
        coins: 0
    };
    users.push(newUser);
    return true; // Пользователь успешно зарегистрирован
}

// Функция для авторизации пользователя
function loginUser(username, password) {
    // Находим пользователя в списке по имени и паролю
    const user = users.find(user => user.username === username && user.password === password);
    return user ? user : null; // Возвращаем найденного пользователя или null, если пользователь не найден
}

// Функция для обработки тапа
function handleTap() {
    const user = getCurrentUser();
    if (user) {
        user.coins += 0.00001;
        updateCoins(user.coins);
    }
}

// Функция для получения текущего пользователя (в данном случае, просто первого в списке)
function getCurrentUser() {
    return users.length > 0 ? users[0] : null;
}

// Функция для обновления отображения количества монет
function updateCoins(coins) {
    document.getElementById('coins').innerText = `ZCOIN: ${coins.toFixed(5)}`;
}

// Обработчики событий для кнопок регистрации, входа и тапа
document.getElementById('register').addEventListener('click', () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const registered = registerUser(username, password);
    if (registered) {
        alert('Registered successfully');
    } else {
        alert('User already exists');
    }
});

document.getElementById('login').addEventListener('click', () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const user = loginUser(username, password);
    if (user) {
        alert('Logged in successfully');
        document.getElementById('auth').style.display = 'none';
        document.getElementById('game').style.display = 'block';
        updateCoins(user.coins);
    } else {
        alert('Login failed');
    }
});

document.getElementById('tapArea').addEventListener('click', handleTap);

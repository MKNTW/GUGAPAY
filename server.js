const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();
const app = express();
const port = process.env.PORT || 3001;

// Схема пользователя
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    userId: { type: String, unique: true },
    balance: { type: Number, default: 0 }
});

// Модель User
const User = mongoose.model('User', userSchema);

// Подключение к MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('[MongoDB] Connected'))
    .catch(err => console.error('[MongoDB] Error:', err));

// Middleware для обхода страницы-напоминания LocalTunnel
app.use((req, res, next) => {
    req.headers['bypass-tunnel-reminder'] = 'true';
    req.headers['user-agent'] = 'Custom-User-Agent';
    next();
});

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Логирование всех запросов
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Обработчик для корневого URL
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>GUGACOIN</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background: #1a1a1a;
                    color: white;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                }
                h1 {
                    font-size: 2.5rem;
                }
            </style>
        </head>
        <body>
            <h1>GUGACOIN</h1>
        </body>
        </html>
    `);
});

// Регистрация
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = Math.floor(100000 + Math.random() * 900000).toString();

        const user = new User({ username, password: hashedPassword, userId, balance: 0 });
        await user.save();

        console.log(`[Register] New user created: ${username}`);
        res.json({ success: true, userId });
    } catch (error) {
        console.error('[Register] Error:', error.message);
        if (error.code === 11000) {
            res.status(409).json({ success: false, error: 'Username already exists' });
        } else {
            res.status(500).json({ success: false, error: 'Registration failed' });
        }
    }
});

// Авторизация
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user) {
            console.error('[Login] Error: User not found');
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            console.error('[Login] Error: Invalid password');
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        console.log(`[Login] User logged in: ${username}`);
        res.json({ 
            success: true, 
            userId: user.userId, 
            balance: user.balance 
        });
    } catch (error) {
        console.error('[Login] Error:', error.message);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

// Обновление баланса
app.post('/update', async (req, res) => {
    try {
        const { userId, amount } = req.body;
        const user = await User.findOneAndUpdate(
            { userId },
            { $inc: { balance: amount } },
            { new: true }
        );

        console.log(`[Update] Balance updated for user: ${userId}, new balance: ${user.balance}`);
        res.json({ success: true, balance: user.balance });
    } catch (error) {
        console.error('[Update] Error:', error.message);
        res.status(500).json({ success: false, error: 'Update failed' });
    }
});

// Перевод монет между пользователями
app.post('/transfer', async (req, res) => {
    try {
        const { fromUserId, toUserId, amount } = req.body;

        // Проверка наличия пользователей
        const fromUser = await User.findOne({ userId: fromUserId });
        const toUser = await User.findOne({ userId: toUserId });

        if (!fromUser || !toUser) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Проверка баланса отправителя
        if (fromUser.balance < amount) {
            return res.status(400).json({ success: false, error: 'Insufficient balance' });
        }

        // Перевод монет
        fromUser.balance -= amount;
        toUser.balance += amount;

        await fromUser.save();
        await toUser.save();

        console.log(`[Transfer] ${amount} coins transferred from ${fromUserId} to ${toUserId}`);
        res.json({ success: true, fromBalance: fromUser.balance, toBalance: toUser.balance });
    } catch (error) {
        console.error('[Transfer] Error:', error.message);
        res.status(500).json({ success: false, error: 'Transfer failed' });
    }
});

// Получение данных пользователя
app.get('/user', async (req, res) => {
    try {
        const { userId } = req.query;
        const user = await User.findOne({ userId });

        if (!user) {
            console.error('[User] Error: User not found');
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        console.log(`[User] Data fetched for user: ${userId}`);
        res.json({ success: true, balance: user.balance });
    } catch (error) {
        console.error('[User] Error:', error.message);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Запуск сервера
app.listen(port, '0.0.0.0', () => {
    console.log(`[Server] Running on http://localhost:${port}`);
});

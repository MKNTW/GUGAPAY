const express = require('express');
const { createClient } = require('@supabase/supabase-js'); // Для работы с Supabase
const bcrypt = require('bcryptjs'); // Для хэширования паролей
const cors = require('cors'); // Для обработки CORS-запросов
require('dotenv').config(); // Для загрузки переменных окружения

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: '*' })); // Разрешаем запросы с любых доменов
app.use(express.json()); // Парсим JSON-данные из запросов

// Подключение к Supabase
const SUPABASE_URL = process.env.SUPABASE_URL; // URL вашего Supabase проекта
const SUPABASE_KEY = process.env.SUPABASE_KEY; // Анонимный ключ доступа
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Регистрация пользователя
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Проверка длины пароля
        if (password.length < 6) {
            return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long' });
        }

        // Хэширование пароля
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = Math.floor(100000 + Math.random() * 900000).toString();

        // Добавление пользователя в таблицу
        const { data, error } = await supabase
            .from('users')
            .insert([{ username, password: hashedPassword, user_id: userId, balance: 0 }])
            .select();

        if (error) {
            console.error('[Register] Error:', error.message);
            return res.status(500).json({ success: false, error: 'Registration failed' });
        }

        console.log(`[Register] New user created: ${username}`);
        res.json({ success: true, userId });
    } catch (error) {
        console.error('[Register] Error:', error.stack);
        res.status(500).json({ success: false, error: 'Registration failed' });
    }
});

// Авторизация пользователя
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Поиск пользователя в таблице
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !data) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Проверка пароля
        const isPasswordValid = await bcrypt.compare(password, data.password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        console.log(`[Login] User logged in: ${username}`);
        res.json({ success: true, userId: data.user_id, balance: data.balance });
    } catch (error) {
        console.error('[Login] Error:', error.stack);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

// Обновление баланса
app.post('/update', async (req, res) => {
    try {
        const { userId, amount } = req.body;

        // Проверка типа данных
        if (typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid amount' });
        }

        // Обновление баланса
        const { data, error } = await supabase
            .from('users')
            .update({ balance: supabase.raw(`balance + ${amount}`) })
            .eq('user_id', userId)
            .select();

        if (error || !data) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        console.log(`[Update] Balance updated for user: ${userId}, new balance: ${data[0].balance}`);
        res.json({ success: true, balance: data[0].balance });
    } catch (error) {
        console.error('[Update] Error:', error.stack);
        res.status(500).json({ success: false, error: 'Update failed' });
    }
});

// Перевод монет между пользователями
app.post('/transfer', async (req, res) => {
    try {
        const { fromUserId, toUserId, amount } = req.body;

        // Проверка типа данных
        if (typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid amount' });
        }

        // Начало транзакции
        const { data: fromUser, error: fromError } = await supabase
            .from('users')
            .select('*')
            .eq('user_id', fromUserId)
            .single();

        const { data: toUser, error: toError } = await supabase
            .from('users')
            .select('*')
            .eq('user_id', toUserId)
            .single();

        if (fromError || toError || !fromUser || !toUser) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Проверка баланса отправителя
        if (fromUser.balance < amount) {
            return res.status(400).json({ success: false, error: 'Insufficient balance' });
        }

        // Перевод монет
        await supabase.rpc('transfer_balance', { from_user_id: fromUserId, to_user_id: toUserId, amount });

        console.log(`[Transfer] Success: ${amount} coins transferred from ${fromUserId} to ${toUserId}`);
        res.json({ success: true, fromBalance: fromUser.balance - amount, toBalance: toUser.balance + amount });
    } catch (error) {
        console.error('[Transfer] Error:', error.stack);
        res.status(500).json({ success: false, error: 'Transfer failed' });
    }
});

// Запуск сервера
app.listen(port, '0.0.0.0', () => {
    console.log(`[Server] Running on http://localhost:${port}`);
});

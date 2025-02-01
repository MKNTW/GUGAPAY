const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Проверка переменных окружения
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error('[Supabase] Error: SUPABASE_URL or SUPABASE_KEY is missing');
    process.exit(1);
}

// Подключение к Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Маршрут для корневого пути "/"
app.get('/', (req, res) => {
    res.send(`
        <h1>Welcome to GUGACOIN!</h1>
        <p>This is the backend server for GUGACOIN.</p>
    `);
});

// Регистрация пользователя
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Username and password are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = Math.floor(100000 + Math.random() * 900000).toString();

        const { data, error } = await supabase
            .from('users')
            .insert([{ username, password: hashedPassword, user_id: userId, balance: 0 }])
            .select();

        if (error) {
            console.error('[Register] Supabase Error:', error.message);
            if (error.message.includes('unique_violation')) {
                return res.status(409).json({ success: false, error: 'Username already exists' });
            }
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

        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !data) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const isPasswordValid = await bcrypt.compare(password, data.password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        console.log(`[Login] User logged in: ${username}`);
        res.json({ success: true, userId: data.user_id });
    } catch (error) {
        console.error('[Login] Error:', error.stack);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

// Обновление баланса
app.post('/update', async (req, res) => {
    try {
        const { userId } = req.body;

        const { data: userData, error: fetchError } = await supabase
            .from('users')
            .select('balance')
            .eq('user_id', userId)
            .single();

        if (fetchError || !userData) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const newBalance = (userData.balance || 0) + 1;

        await supabase
            .from('users')
            .update({ balance: newBalance })
            .eq('user_id', userId);

        console.log(`[Update] Balance updated for user: ${userId}, new balance: ${newBalance}`);
        res.json({ success: true, balance: newBalance });
    } catch (error) {
        console.error('[Update] Error:', error.stack);
        res.status(500).json({ success: false, error: 'Update failed' });
    }
});

// Получение данных пользователя
app.get('/user', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'User ID is required' });
        }

        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error || !data) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const user = {
            user_id: data.user_id,
            username: data.username,
            balance: data.balance || 0
        };

        console.log(`[User] Data fetched for user: ${userId}`);
        res.json({ success: true, user });
    } catch (error) {
        console.error('[User] Error:', error.stack);
        res.status(500).json({ success: false, error: 'Failed to fetch user data' });
    }
});

// Перевод монет
app.post('/transfer', async (req, res) => {
    try {
        const { fromUserId, toUserId, amount } = req.body;

        if (typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid amount' });
        }

        // Проверяем отправителя
        const { data: fromUser, error: fromError } = await supabase
            .from('users')
            .select('*')
            .eq('user_id', fromUserId)
            .single();

        if (fromError || !fromUser) {
            return res.status(404).json({ success: false, error: 'Sender not found' });
        }

        if ((fromUser.balance || 0) < amount) {
            return res.status(400).json({ success: false, error: 'Insufficient balance' });
        }

        // Проверяем получателя
        const { data: toUser, error: toError } = await supabase
            .from('users')
            .select('*')
            .eq('user_id', toUserId)
            .single();

        if (toError || !toUser) {
            return res.status(404).json({ success: false, error: 'Recipient not found' });
        }

        // Обновляем балансы
        const newFromBalance = (fromUser.balance || 0) - amount;
        const newToBalance = (toUser.balance || 0) + amount;

        await supabase
            .from('users')
            .update({ balance: newFromBalance })
            .eq('user_id', fromUserId);

        await supabase
            .from('users')
            .update({ balance: newToBalance })
            .eq('user_id', toUserId);

        // Записываем транзакцию
        await supabase
            .from('transactions')
            .insert([
                {
                    from_user_id: fromUserId,
                    to_user_id: toUserId,
                    amount: amount
                }
            ]);

        console.log(`[Transfer] Success: ${amount} coins transferred from ${fromUserId} to ${toUserId}`);
        res.json({ success: true, fromBalance: newFromBalance, toBalance: newToBalance });
    } catch (error) {
        console.error('[Transfer] Error:', error.stack);
        res.status(500).json({ success: false, error: 'Transfer failed' });
    }
});

// Запуск сервера
app.listen(port, '0.0.0.0', () => {
    console.log(`[Server] Running on http://localhost:${port}`);
});

// server.js

/* ========================
   ИМПОРТЫ И НАСТРОЙКИ СЕРВЕРА
======================== */

// Подключение необходимых модулей и настройка переменных окружения
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const env = process.env.NODE_ENV || 'development';
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Инициализация Redis для кеширования
const { createClient: createRedisClient } = require('redis');
const redisClient = createRedisClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });

// Подключение к Redis для кеширования результатов
redisClient.connect().catch(err => {
  console.error('[Redis] Ошибка подключения:', err);
});

// Настройка CSRF-защиты (Cross-Site Request Forgery)
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

/* ========================
   ФУНКЦИИ И ВАЛИДАЦИЯ
======================== */

// Проверка подписи Telegram (для /auth/telegram)
function isTelegramAuthValid(data, botToken) {
  const crypto = require('crypto');
  const checkHash = data.hash;
  const { hash, ...rest } = data;
  const sorted = Object.keys(rest).sort().map(key => `${key}=${rest[key]}`).join('\n');
  const secret = crypto.createHash('sha256').update(botToken).digest();
  const hmac = crypto.createHmac('sha256', secret).update(sorted).digest('hex');
  return hmac === checkHash;
}

/* ========================
   ИНИЦИАЛИЗАЦИЯ TELEGRAM-БОТА
======================== */

// Инициализация Telegram-бота (опционально, если используется для фоновых задач)
const TelegramBot = require('node-telegram-bot-api');
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
if (!TELEGRAM_BOT_TOKEN) {
  console.error('Ошибка: TELEGRAM_BOT_TOKEN не установлен');
  process.exit(1);
}

let telegramBot = null;
if (env.telegram && env.telegram.enabled) {
  try {
    telegramBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

    // Обработчик ошибок polling для Telegram-бота
    telegramBot.on('polling_error', (error) => {
      console.error('[TelegramBot] polling_error:', error.code, error.message);
    });
  } catch (error) {
    console.error('[TelegramBot] Ошибка инициализации:', error);
  }
}

/* ========================
   ИНИЦИАЛИЗАЦИЯ EXPRESS-ПРИЛОЖЕНИЯ
======================== */

const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_jwt_secret';

// Проверка необходимых переменных окружения для Supabase
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('[Supabase] Ошибка: отсутствует SUPABASE_URL или SUPABASE_KEY');
  process.exit(1);
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Настройка CORS (Cross-Origin Resource Sharing)
const corsOptions = {
  origin: [
    'https://mkntw.ru',
    'https://mkntw.github.io/gugacoin/' // домен разработки
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Глобальные middleware: безопасность, CORS, парсинг
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
// Включение защиты CSRF (Cross-Site Request Forgery)
app.use((req, res, next) => {
  if (["POST", "PUT", "DELETE"].includes(req.method)) {
    return csrfProtection(req, res, next);
  }
  next();
});

// Маршрут для получения CSRF-токена
app.get('/csrf-token', (req, res) => {
  try {
    const token = req.csrfToken();
    res.json({ csrfToken: token });
  } catch (err) {
    console.error('[csrf-token] Ошибка получения CSRF:', err);
    res.status(200).json({ csrfToken: '' }); // <-- безопасная заглушка
  }
});

// Ограничение количества запросов (Rate Limiting) для некоторых маршрутов авторизации
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 1000,
  message: 'Слишком много запросов с этого IP, попробуйте позже.'
});
app.use(['/login', '/register', '/merchantLogin'], authLimiter);

/* ========================
   AUTHENTICATION MIDDLEWARE
======================== */

// Middleware для проверки JWT-токена (авторизация)
function verifyToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ success: false, error: 'Отсутствует токен авторизации' });
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Неверный или просроченный токен' });
    }
    req.user = decoded;
    next();
  });
}

/* ========================
   AUTHENTICATION ENDPOINTS
======================== */

// Endpoint для выхода (logout) - очистка JWT-кук
app.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none'
  });
  res.json({ success: true, message: 'Вы вышли из системы' });
});

// Тестовый endpoint для проверки сервера
app.get('/', (req, res) => {
  res.send('GugaCoin backend server.');
});

/* ========================
   1) РЕГИСТРАЦИЯ ПОЛЬЗОВАТЕЛЯ
======================== */

const registerSchema = Joi.object({
  username: Joi.string().min(3).required(),
  password: Joi.string().min(6).required()
});

app.post('/register', async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }
    const { username, password } = value;
    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = Math.floor(100000 + Math.random() * 900000).toString();

    // Вставляем нового пользователя в базу данных
    const { error: supabaseError } = await supabase
      .from('users')
      .insert([{
        username,
        password: hashedPassword,
        user_id: userId,
        balance: 0,
        rub_balance: 0,
        blocked: 0
      }]);

    if (supabaseError) {
      if (supabaseError.message.includes('unique')) {
        return res.status(409).json({ success: false, error: 'Такой логин уже существует' });
      }
      return res.status(500).json({ success: false, error: supabaseError.message });
    }

    res.json({ success: true, message: 'Пользователь успешно зарегистрирован', userId });
  } catch (err) {
    console.error('[register] Ошибка:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

/* ========================
   2) ЛОГИН ПОЛЬЗОВАТЕЛЯ
======================== */

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required()
});

app.post('/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }
    const { username, password } = value;
    const { data, error: supabaseError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();
    if (supabaseError || !data) {
      return res.status(401).json({ success: false, error: 'Неверные данные пользователя' });
    }
    if (data.blocked === 1) {
      return res.status(403).json({ success: false, error: 'Аккаунт заблокирован' });
    }
    const isPassOk = await bcrypt.compare(password, data.password);
    if (!isPassOk) {
      return res.status(401).json({ success: false, error: 'Неверные данные пользователя' });
    }
    // Успешный вход: выдаем JWT-токен
    const token = jwt.sign({ userId: data.user_id, role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
    res.cookie('token', token, {
      httpOnly: true,
      secure: env === 'production',
      sameSite: 'none',
      maxAge: 3600000
    });
    res.json({ success: true, message: 'Пользователь успешно авторизован', user: data });
  } catch (err) {
    console.error('[login] Ошибка:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

/* ========================
   3) ЛОГИН МЕРЧАНТА
======================== */

const merchantLoginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required()
});

app.post('/merchantLogin', async (req, res) => {
  try {
    const { error, value } = merchantLoginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }
    const { username, password } = value;
    const { data, error: supabaseError } = await supabase
      .from('merchants')
      .select('*')
      .eq('merchant_login', username)
      .single();
    if (supabaseError || !data) {
      return res.status(401).json({ success: false, error: 'Неверные данные пользователя' });
    }
    if (data.blocked === 1) {
      return res.status(403).json({ success: false, error: 'Аккаунт заблокирован' });
    }
    const isPassOk = await bcrypt.compare(password, data.merchant_password);
    if (!isPassOk) {
      return res.status(401).json({ success: false, error: 'Неверные данные пользователя' });
    }
    const token = jwt.sign({ merchantId: data.merchant_id, role: 'merchant' }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('token', token, {
      httpOnly: true,
      secure: env === 'production',
      sameSite: 'none',
      maxAge: 24 * 3600000
    });
    console.log('[MerchantLogin] Мерчант вошёл:', username, ' merchantId=', data.merchant_id);
    res.json({ success: true, message: 'Мерчант успешно авторизован' });
  } catch (err) {
    console.error('[merchantLogin] Ошибка:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

/* ========================
   4) МАЙНИНГ (/update)
======================== */

const updateMiningSchema = Joi.object({
  amount: Joi.number().positive().required()
});

app.post('/update', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ success: false, error: 'Доступ запрещён' });
    }
    const userId = req.user.userId;
    const { error, value } = updateMiningSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }
    const { amount } = value;
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (!userData) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }
    if (userData.blocked === 1) {
      return res.status(403).json({ success: false, error: 'Аккаунт заблокирован' });
    }
    const newBalance = parseFloat(userData.balance || 0) + amount;
    const { error: updateErr } = await supabase
      .from('users')
      .update({ balance: newBalance.toFixed(5) })
      .eq('user_id', userId);
    if (updateErr) {
      return res.status(500).json({ success: false, error: 'Не удалось обновить баланс' });
    }
    const { data: halvingData } = await supabase
      .from('halving')
      .select('*')
      .limit(1);
    let totalMined = amount;
    if (halvingData && halvingData.length > 0) {
      totalMined = parseFloat(halvingData[0].total_mined || 0) + amount;
    }
    const halvingStep = Math.floor(totalMined);
    await supabase
      .from('halving')
      .upsert([{ id: 1, total_mined: totalMined, halving_step: halvingStep }]);
    console.log('[Mining] userId=', userId, ' +', amount, ' =>', newBalance);
    res.json({ success: true, balance: newBalance.toFixed(5), halvingStep });
  } catch (err) {
    console.error('[update/mining] Ошибка:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

/* ========================
   5) GET /user (получение данных пользователя)
======================== */

app.get('/user', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ success: false, error: 'Доступ запрещён' });
    }
    const userId = req.user.userId;
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (!userData) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }
    if (userData.blocked === 1) {
      return res.status(403).json({ success: false, error: 'Пользователь заблокирован' });
    }
    let halvingStep = 0;
    const { data: halvingData } = await supabase
      .from('halving')
      .select('halving_step')
      .limit(1);
    if (halvingData && halvingData.length > 0) {
      halvingStep = halvingData[0].halving_step;
    }
    res.json({ success: true, user: { ...userData, halvingStep } });
  } catch (err) {
    console.error('[get /user] Ошибка:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

/* ========================
   6) POST /transfer (перевод монет между пользователями)
======================== */

const transferSchema = Joi.object({
  toUserId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  tags: Joi.string().allow('', null) // теги опциональны
}).unknown(true);

app.post('/transfer', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ success: false, error: 'Доступ запрещён' });
    }
    const fromUserId = req.user.userId;
    const { error, value } = transferSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }
    const { toUserId, amount, tags } = value;
    if (fromUserId === toUserId) {
      return res.status(400).json({ success: false, error: 'Нельзя переводить самому себе' });
    }
    const { data: fromUser } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', fromUserId)
      .single();
    if (!fromUser) {
      return res.status(404).json({ success: false, error: 'Отправитель не найден' });
    }
    if (parseFloat(fromUser.balance) < amount) {
      return res.status(400).json({ success: false, error: 'Недостаточно средств' });
    }
    const { data: toUser } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', toUserId)
      .single();
    if (!toUser) {
      return res.status(404).json({ success: false, error: 'Получатель не найден' });
    }
    const newFromBalance = parseFloat(fromUser.balance) - amount;
    const newToBalance = parseFloat(toUser.balance) + amount;
    await supabase
      .from('users')
      .update({ balance: newFromBalance.toFixed(5) })
      .eq('user_id', fromUserId);
    await supabase
      .from('users')
      .update({ balance: newToBalance.toFixed(5) })
      .eq('user_id', toUserId);
    // Генерация уникального хеша транзакции
    const crypto = require('crypto');
    const generateHash = () => crypto.randomBytes(16).toString('hex');
    const hash = generateHash();
    const { error: insertError } = await supabase
      .from('transactions')
      .insert([{
        from_user_id: fromUserId,
        to_user_id: toUserId,
        amount,
        hash,
        tags: tags || null,
        type: 'sent',
        currency: 'GUGA'
      }]);
    if (insertError) {
      console.error('Ошибка вставки транзакции:', insertError);
      return res.status(500).json({ success: false, error: 'Ошибка записи транзакции' });
    }
    console.log(`[transfer] ${fromUserId} → ${toUserId} = ${amount} GUGA, hash=${hash}`);
    res.json({
      success: true,
      fromBalance: newFromBalance,
      toBalance: newToBalance,
      hash
    });
  } catch (err) {
    console.error('[transfer] Ошибка:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

/* ========================
   6.1) POST /transferRub (перевод рублей между пользователями)
======================== */

app.post('/transferRub', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ success: false, error: 'Доступ запрещён' });
    }
    const fromUserId = req.user.userId;
    const { toUserId, amount, tags } = req.body;
    if (!toUserId || !amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Неверные данные' });
    }
    if (fromUserId === toUserId) {
      return res.status(400).json({ success: false, error: 'Нельзя переводить самому себе' });
    }
    const { data: fromUser } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', fromUserId)
      .single();
    const { data: toUser } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', toUserId)
      .single();
    if (!fromUser || !toUser) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }
    const rubBalance = parseFloat(fromUser.rub_balance || 0);
    if (rubBalance < amount) {
      return res.status(400).json({ success: false, error: 'Недостаточно рублей' });
    }
    const newFromRub = rubBalance - amount;
    const newToRub = parseFloat(toUser.rub_balance || 0) + amount;
    await supabase
      .from('users')
      .update({ rub_balance: newFromRub.toFixed(2) })
      .eq('user_id', fromUserId);
    await supabase
      .from('users')
      .update({ rub_balance: newToRub.toFixed(2) })
      .eq('user_id', toUserId);
    // Генерация уникального хеша транзакции (RUB)
    const crypto = require('crypto');
    const generateHash = () => crypto.randomBytes(16).toString('hex');
    const hash = generateHash();
    const { error: insertError } = await supabase
      .from('transactions')
      .insert([{
        from_user_id: fromUserId,
        to_user_id: toUserId,
        amount,
        hash,
        tags: tags || null,
        type: 'sent',
        currency: 'RUB'
      }]);
    if (insertError) {
      console.error('Ошибка вставки транзакции (RUB):', insertError);
      return res.status(500).json({ success: false, error: 'Ошибка записи транзакции' });
    }
    console.log(`[transferRub] ${fromUserId} → ${toUserId} = ${amount}₽`);
    res.json({ success: true, newFromRub, newToRub, hash });
  } catch (err) {
    console.error('[transferRub] Ошибка:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

/* ========================
   7) GET /transactions (история транзакций)
======================== */

app.get('/transactions', verifyToken, async (req, res) => {
  try {
    let allTransactions = [];
    if (req.user.role === 'user') {
      const userId = req.user.userId;
      const { data: sentTx, error: sentError } = await supabase
        .from('transactions')
        .select('*')
        .eq('from_user_id', userId)
        .order('created_at', { ascending: false });
      const { data: receivedTx, error: receivedError } = await supabase
        .from('transactions')
        .select('*')
        .eq('to_user_id', userId)
        .order('created_at', { ascending: false });
      if (sentError || receivedError) {
        return res.status(500).json({ success: false, error: 'Ошибка при получении транзакций пользователя' });
      }
      allTransactions = [
        ...(sentTx || []).map(tx => ({ ...tx, display_time: tx.created_at })),
        ...(receivedTx || []).map(tx => ({ ...tx, display_time: tx.created_at }))
      ];
      const { data: exchangeTx, error: exchangeError } = await supabase
        .from('exchange_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('client_time', { ascending: false });
      if (!exchangeError) {
        const mappedExchangeTx = (exchangeTx || []).map(tx => ({
          ...tx,
          type: 'exchange',
          display_time: tx.client_time || tx.created_at
        }));
        allTransactions = [...allTransactions, ...mappedExchangeTx];
      }
    } else if (req.user.role === 'merchant') {
      const merchantId = req.user.merchantId;
      const { data: merchantPayments, error: merchantError } = await supabase
        .from('merchant_payments')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false });
      if (merchantError) {
        return res.status(500).json({ success: false, error: 'Ошибка при получении транзакций мерчанта' });
      }
      allTransactions = (merchantPayments || []).map(tx => ({
        ...tx,
        type: 'merchant_payment',
        display_time: tx.created_at
      }));
    } else {
      return res.status(400).json({ success: false, error: 'Неверная роль для получения транзакций' });
    }
    // Отбираем последние 20 транзакций (сортировка уже выполнена запросами выше)
    allTransactions.sort((a, b) => new Date(b.display_time) - new Date(a.display_time));
    const last20Transactions = allTransactions.slice(0, 20);
    console.log('Последние 20 транзакций:', last20Transactions);
    res.json({ success: true, transactions: last20Transactions });
  } catch (err) {
    console.error('[transactions] Ошибка:', err);
    res.status(500).json({ success: false, error: 'Ошибка при получении истории' });
  }
});

/* ========================
   9) POST /merchantTransfer (мерчант → пользователь)
======================== */

const merchantTransferSchema = Joi.object({
  toUserId: Joi.string().required(),
  amount: Joi.number().positive().required()
}).unknown(true);

app.post('/merchantTransfer', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'merchant') {
      return res.status(403).json({ success: false, error: 'Доступ запрещён' });
    }
    const merchantId = req.user.merchantId;
    const { error, value } = merchantTransferSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }
    const { toUserId, amount } = value;
    if (!merchantId) {
      return res.status(400).json({ success: false, error: 'Отсутствует идентификатор мерчанта' });
    }
    const { data: merch } = await supabase
      .from('merchants')
      .select('*')
      .eq('merchant_id', merchantId)
      .single();
    if (!merch) {
      return res.status(404).json({ success: false, error: 'Мерчант не найден' });
    }
    if (merch.blocked === 1) {
      return res.status(403).json({ success: false, error: 'Аккаунт заблокирован' });
    }
    if (parseFloat(merch.balance) < amount) {
      return res.status(400).json({ success: false, error: 'Недостаточно средств у мерчанта' });
    }
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', toUserId)
      .single();
    if (!user) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }
    const newMerchantBal = parseFloat(merch.balance) - amount;
    await supabase
      .from('merchants')
      .update({ balance: newMerchantBal.toFixed(5) })
      .eq('merchant_id', merchantId);
    const newUserBal = parseFloat(user.balance) + amount;
    await supabase
      .from('users')
      .update({ balance: newUserBal.toFixed(5) })
      .eq('user_id', toUserId);
    const { error: insertError } = await supabase
      .from('transactions')
      .insert([{ from_user_id: 'MERCHANT:' + merchantId, to_user_id: toUserId, amount, type: 'received' }]);
    if (insertError) {
      console.error('Ошибка вставки транзакции (merchantTransfer):', insertError);
      return res.status(500).json({ success: false, error: 'Ошибка записи транзакции' });
    }
    console.log(`[merchantTransfer] merchant=${merchantId} -> user=${toUserId} amount=${amount}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[merchantTransfer] Ошибка:', err);
    res.status(500).json({ success: false, error: 'Ошибка при переводе мерчант->пользователь' });
  }
});

/* ========================
   10) POST /payMerchantOneTime (оплата QR-кода мерчанта пользователем)
======================== */

const payMerchantSchema = Joi.object({
  merchantId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  purpose: Joi.string().allow('')
}).unknown(true);

app.post('/payMerchantOneTime', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ success: false, error: 'Доступ запрещён' });
    }
    const userId = req.user.userId;
    const { error, value } = payMerchantSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }
    const { merchantId, amount, purpose } = value;
    
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (!userData) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }
    if (userData.blocked === 1) {
      return res.status(403).json({ success: false, error: 'Пользователь заблокирован' });
    }
    if (parseFloat(userData.balance) < amount) {
      return res.status(400).json({ success: false, error: 'Недостаточно средств у пользователя' });
    }
    
    const { data: merchData } = await supabase
      .from('merchants')
      .select('*')
      .eq('merchant_id', merchantId)
      .single();
    if (!merchData) {
      return res.status(404).json({ success: false, error: 'Мерчант не найден' });
    }
    if (merchData.blocked === 1) {
      return res.status(403).json({ success: false, error: 'Мерчант заблокирован' });
    }
    
    const newUserBalance = parseFloat(userData.balance) - amount;
    await supabase
      .from('users')
      .update({ balance: newUserBalance.toFixed(5) })
      .eq('user_id', userId);
      
    const merchantAmount = amount;
    const newMerchantBalance = parseFloat(merchData.balance) + merchantAmount;
    await supabase
      .from('merchants')
      .update({ balance: newMerchantBalance.toFixed(5) })
      .eq('merchant_id', merchantId);
      
    const { error: insertError } = await supabase
      .from('transactions')
      .insert([{ from_user_id: userId, to_user_id: 'MERCHANT:' + merchantId, amount, type: 'merchant_payment' }]);
    if (insertError) {
      console.error('Ошибка вставки транзакции для мерчанта:', insertError);
      return res.status(500).json({ success: false, error: 'Ошибка записи транзакции' });
    }
    
    await supabase
      .from('merchant_payments')
      .insert([{ user_id: userId, merchant_id: merchantId, amount: merchantAmount, purpose }]);
      
    console.log(`[payMerchantOneTime] user=${userId} => merchant=${merchantId}, amount=${amount}, merchantGets=${merchantAmount}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[payMerchantOneTime] Ошибка:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера при оплате мерчанту' });
  }
});

/* ========================
   11) GET /merchantBalance (получение баланса мерчанта)
======================== */

app.get('/merchantBalance', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'merchant') {
      return res.status(403).json({ success: false, error: 'Доступ запрещён' });
    }
    const merchantId = req.user.merchantId;
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('merchant_id', merchantId)
      .single();
    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Мерчант не найден' });
    }
    res.json({ success: true, balance: data.balance });
  } catch (err) {
    console.error('[merchantBalance] Ошибка:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

/* ========================
   12) POST /exchange (обмен RUB ↔ COIN)
======================== */

const exchangeSchema = Joi.object({
  direction: Joi.string().valid('rub_to_coin', 'coin_to_rub').required(),
  amount: Joi.number().positive().required()
});

app.post('/exchange', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ success: false, error: 'Доступ запрещён' });
    }
    const userId = req.user.userId;
    const { error, value } = exchangeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }
    const { direction, amount } = value;
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (userError || !userData) {
      console.error("Ошибка получения пользователя:", userError);
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }
    if (userData.blocked === 1) {
      return res.status(403).json({ success: false, error: 'Пользователь заблокирован' });
    }
    const { data: poolData, error: poolError } = await supabase
      .from('liquidity_pool')
      .select('*')
      .eq('id', 1)
      .single();
    if (poolError || !poolData) {
      console.error("Ошибка получения данных пула:", poolError);
      return res.status(500).json({ success: false, error: 'Данные пула не найдены' });
    }
    let reserveCoin = parseFloat(poolData.reserve_coin);
    let reserveRub = parseFloat(poolData.reserve_rub);
    let newReserveCoin, newReserveRub, outputAmount;
    const fee = 0.02; // комиссия 2%
    if (direction === 'rub_to_coin') {
      const userRub = parseFloat(userData.rub_balance || 0);
      if (userRub < amount) {
        return res.status(400).json({ success: false, error: 'Недостаточно рублей' });
      }
      const effectiveRub = amount * (1 - fee);
      outputAmount = reserveCoin - (reserveCoin * reserveRub) / (reserveRub + effectiveRub);
      if (outputAmount <= 0) {
        return res.status(400).json({ success: false, error: 'Невозможно выполнить обмен' });
      }
      newReserveRub = reserveRub + effectiveRub;
      newReserveCoin = reserveCoin - outputAmount;
      const newUserRub = userRub - amount;
      const userCoin = parseFloat(userData.balance || 0);
      const newUserCoin = userCoin + outputAmount;
      const { error: updateUserError } = await supabase
        .from('users')
        .update({
          rub_balance: Number(newUserRub.toFixed(2)),
          balance: Number(newUserCoin.toFixed(5))
        })
        .eq('user_id', userId);
      if (updateUserError) {
        console.error("Ошибка обновления пользователя:", updateUserError);
        return res.status(500).json({ success: false, error: 'Ошибка обновления баланса пользователя' });
      }
    } else if (direction === 'coin_to_rub') {
      const userCoin = parseFloat(userData.balance || 0);
      if (userCoin < amount) {
        return res.status(400).json({ success: false, error: 'Недостаточно монет' });
      }
      const effectiveCoin = amount * (1 - fee);
      outputAmount = reserveRub - (reserveRub * reserveCoin) / (reserveCoin + effectiveCoin);
      if (outputAmount <= 0) {
        return res.status(400).json({ success: false, error: 'Невозможно выполнить обмен' });
      }
      newReserveCoin = reserveCoin + effectiveCoin;
      newReserveRub = reserveRub - outputAmount;
      const userRub = parseFloat(userData.rub_balance || 0);
      const newUserRub = userRub + outputAmount;
      const newUserCoin = userCoin - amount;
      const { error: updateUserError } = await supabase
        .from('users')
        .update({
          rub_balance: Number(newUserRub.toFixed(2)),
          balance: Number(newUserCoin.toFixed(5))
        })
        .eq('user_id', userId);
      if (updateUserError) {
        console.error("Ошибка обновления пользователя:", updateUserError);
        return res.status(500).json({ success: false, error: 'Ошибка обновления баланса пользователя' });
      }
    } else {
      return res.status(400).json({ success: false, error: 'Неверное направление обмена' });
    }
    const newExchangeRate = newReserveRub / newReserveCoin;
    if (newExchangeRate < 0.01) {
      return res.status(400).json({ success: false, error: 'Обмен невозможен: курс не может опуститься ниже 0.01' });
    }
    const { error: updatePoolError } = await supabase
      .from('liquidity_pool')
      .update({
        reserve_coin: Number(newReserveCoin.toFixed(5)),
        reserve_rub: Number(newReserveRub.toFixed(2)),
        updated_at: new Date().toISOString()
      })
      .eq('id', 1);
    if (updatePoolError) {
      console.error("Ошибка обновления пула:", updatePoolError);
      return res.status(500).json({ success: false, error: 'Ошибка обновления данных пула' });
    }
    const { error: txError } = await supabase
      .from('exchange_transactions')
      .insert([{
        user_id: userId,
        direction,
        amount,
        exchanged_amount: Number(outputAmount.toFixed(5)),
        new_rub_balance: direction === 'rub_to_coin'
          ? Number((parseFloat(userData.rub_balance) - amount).toFixed(2))
          : Number((parseFloat(userData.rub_balance) + outputAmount).toFixed(2)),
        new_coin_balance: direction === 'rub_to_coin'
          ? Number((parseFloat(userData.balance) + outputAmount).toFixed(5))
          : Number((parseFloat(userData.balance) - amount).toFixed(5)),
        created_at: new Date().toISOString(),
        exchange_rate: Number(newExchangeRate.toFixed(5))
      }]);
    if (txError) {
      console.error('Ошибка записи транзакции:', txError);
      return res.status(500).json({ success: false, error: 'Ошибка записи транзакции' });
    }
    const rateValue = Number(newExchangeRate.toFixed(5));
    const { error: rateError } = await supabase
      .from('exchange_rate_history')
      .insert([{ exchange_rate: rateValue }]);
    if (rateError) {
      console.error('Ошибка записи курса в историю:', rateError);
    }
    return res.json({
      success: true,
      newRubBalance: direction === 'rub_to_coin'
        ? Number((parseFloat(userData.rub_balance) - amount).toFixed(2))
        : Number((parseFloat(userData.rub_balance) + outputAmount).toFixed(2)),
      newCoinBalance: direction === 'rub_to_coin'
        ? Number((parseFloat(userData.balance) + outputAmount).toFixed(5))
        : Number((parseFloat(userData.balance) - amount).toFixed(5)),
      currentratedisplay: Number(newExchangeRate.toFixed(5)),
      exchanged_amount: Number(outputAmount.toFixed(5))
    });
  } catch (err) {
    console.error('[exchange] Ошибка:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

/* ========================
   11) GET /exchangeRates (история обменных курсов)
======================== */

app.get('/exchangeRates', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    let query = supabase
      .from('exchange_rate_history')
      .select('*')
      .order('created_at', { ascending: false });
    if (limit) {
      query = query.limit(limit);
    }
    const { data, error } = await query;
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.json({ success: true, rates: data });
  } catch (err) {
    console.error('[exchangeRates] Ошибка:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

/* ========================
   12) POST /cloudtips/callback (вебхук платежной системы CloudTips)
======================== */

app.post('/cloudtips/callback', async (req, res) => {
  try {
    const { orderId, status, amount, comment } = req.body;
    if (status !== 'success') {
      return res.status(400).json({ success: false, error: 'Платеж неуспешен' });
    }
    const userIdRegex = /(\d+)/;
    const match = comment?.match(userIdRegex);
    if (!match) {
      return res.status(400).json({ success: false, error: 'userId не найден в комментарии' });
    }
    const userId = match[1];
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (userError || !user) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }
    if (user.blocked === 1) {
      return res.status(403).json({ success: false, error: 'Пользователь заблокирован' });
    }
    const currentRubBalance = parseFloat(user.rub_balance || 0);
    const newRubBalance = (currentRubBalance + parseFloat(amount)).toFixed(2);
    const { error: updateErr } = await supabase
      .from('users')
      .update({ rub_balance: newRubBalance })
      .eq('user_id', userId);
    if (updateErr) {
      return res.status(500).json({ success: false, error: 'Не удалось обновить баланс' });
    }
    const { error: insertErr } = await supabase
      .from('cloudtips_transactions')
      .insert([{ order_id: orderId, user_id: userId, rub_amount: amount }]);
    if (insertErr) {
      console.error('Ошибка записи cloudtips_transactions:', insertErr);
      return res.status(500).json({ success: false, error: 'Ошибка записи транзакции' });
    }
    console.log(`[CloudtipsCallback] user=${userId}, amount=${amount}, orderId=${orderId}`);
    res.json({ success: true, newRubBalance });
  } catch (err) {
    console.error('[cloudtips/callback] Ошибка:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

/* ========================
   13) GET /merchant/info (информация о мерчанте)
======================== */

app.get('/merchant/info', verifyToken, async (req, res) => {
  if (req.user.role !== 'merchant') {
    return res.status(403).json({ success: false, error: 'Доступ запрещён' });
  }
  const merchantId = req.user.merchantId;
  const { data: merchantData, error } = await supabase
    .from('merchants')
    .select('*')
    .eq('merchant_id', merchantId)
    .single();
  if (error || !merchantData) {
    return res.status(404).json({ success: false, error: 'Мерчант не найден' });
  }
  res.json({ success: true, merchant: merchantData });
});

/* ========================
   14) POST /auth/telegram (авторизация через Telegram)
======================== */

app.post('/auth/telegram', async (req, res) => {
  if (!isTelegramAuthValid(req.body, TELEGRAM_BOT_TOKEN)) {
    return res.status(403).json({ success: false, error: 'Неверная подпись Telegram' });
  }
  try {
    const { telegramId, firstName, username, photoUrl } = req.body;

    // Поиск существующего пользователя по telegramId
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .maybeSingle();
    if (existingUser) {
      // Пользователь уже зарегистрирован: выдаем токен и возвращаем существующий userId
      const token = jwt.sign({ userId: existingUser.user_id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '24h' });
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 86400000
      });
      return res.json({
        success: true,
        userId: existingUser.user_id,
        isNewUser: false
      });
    }

    // Регистрация нового пользователя через Telegram
    const userId = await generateSixDigitId(); // Генерируем уникальный шестизначный ID

    // Генерация уникального имени пользователя (если username занят или отсутствует)
    const generateUniqueUsername = async (base) => {
      let candidate = (base || `user${Date.now()}`).substring(0, 15);
      let counter = 1;
      while (true) {
        const { data } = await supabase
          .from('users')
          .select('username')
          .eq('username', candidate)
          .maybeSingle();
        if (!data) return candidate;
        candidate = `${base}_${counter++}`.substring(0, 15);
      }
    };
    const uniqueUsername = await generateUniqueUsername(username || firstName);

    // Создание новой записи пользователя в базе данных
    const { error } = await supabase.from('users').insert([{
      user_id: userId,
      telegram_id: telegramId,
      username: uniqueUsername,
      first_name: firstName?.substring(0, 30),
      photo_url: photoUrl,
      balance: 0,
      rub_balance: 0,
      blocked: false,
      password: null
    }]);
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ success: false, error: 'Ошибка регистрации' });
    }

    // Генерация JWT-токена для нового пользователя
    const token = jwt.sign({ userId, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 86400000
    });
    res.json({
      success: true,
      userId: userId,
      isNewUser: true
    });
  } catch (error) {
    console.error('Telegram auth error:', error);
    res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  }
});

// Функция для генерации уникального шестизначного идентификатора пользователя
async function generateSixDigitId() {
  let id;
  let isUnique = false;
  while (!isUnique) {
    id = Math.floor(100000 + Math.random() * 900000).toString();
    const { data } = await supabase
      .from('users')
      .select('user_id')
      .eq('user_id', id)
      .maybeSingle();
    if (!data) isUnique = true;
  }
  return id;
}

/* ========================
   15) GET /transaction/:hash (поиск транзакции по хешу)
======================== */

app.get('/transaction/:hash', async (req, res) => {
  const { hash } = req.params;
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('hash', hash)
    .single();
  if (error || !data) {
    return res.status(404).json({ success: false, error: 'Транзакция не найдена' });
  }
  res.json({ success: true, transaction: data });
});

/* ========================
   ЗАПУСК СЕРВЕРА
======================== */

app.listen(port, '0.0.0.0', () => {
  console.log(`[Server] Запущен на порту ${port}`);
});

/* ========================
   БЕЗОПАСНОСТЬ И ЛОГИРОВАНИЕ
======================== */

// Логирование подозрительных запросов (с неразрешёнными источниками)
app.use(async (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const origin = req.headers.origin || req.headers.referer || '';
  const ua = req.headers['user-agent'] || '';
  const url = req.originalUrl;
  if (origin && !origin.includes('mkntw.ru')) {
    console.warn(`[SECURITY] Нарушение: ${ip} → ${url}, origin=${origin}`);
    await supabase.from('security_logs').insert([{
      ip, url, origin, user_agent: ua, timestamp: new Date().toISOString()
    }]);
  }
  next();
});

// WAF: защита от внешних запросов (блокировка запросов с неизвестных источников)
app.use((req, res, next) => {
  const origin = req.headers.origin || req.headers.referer || '';
  if (origin && !origin.includes('mkntw.ru')) {
    console.warn(`[WAF] Блокирован внешний запрос: ${origin}`);
    return res.status(403).json({ error: 'Запрещённый источник' });
  }
  next();
});

// Endpoint для проверки соединения сервера
app.get('/ping', (req, res) => res.sendStatus(200));

/* ========================
   УНИВЕРСАЛЬНЫЙ SYNC-ЭНДПОИНТ
======================== */

app.get('/sync', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const cacheKey = `sync:${userId}`;
    // Проверяем кеш Redis
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    // Параллельные запросы к базе данных (Promise.all для оптимизации)
    const [userData, txData, exchangeData, rateData] = await Promise.all([
      supabase.from('users').select('*').eq('user_id', userId).single(),
      supabase.from('transactions').select('*').or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`).order('created_at', { ascending: false }).limit(10),
      supabase.from('exchange_transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
      supabase.from('exchange_rate_history').select('*').order('created_at', { ascending: false }).limit(1)
    ]);
    const payload = {
      success: true,
      user: userData.data,
      transactions: txData.data,
      exchange: exchangeData.data,
      latestRate: rateData.data[0]
    };
    // Кешируем результат в Redis на короткое время (например, 1 секунда)
    await redisClient.set(cacheKey, JSON.stringify(payload), { EX: 1 });
    res.json(payload);
  } catch (err) {
    console.error('[sync] Ошибка:', err);
    res.status(500).json({ success: false, error: 'Ошибка синхронизации' });
  }
});
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const { createClient: createRedisClient } = require('redis');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

// === CORS ===
app.use(cors({
  origin: "https://mkntw.ru",
  credentials: true
}));

// === Безопасность и парсеры ===
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

// === Инициализация CSRF защиты ===
const csrfProtection = csrf({ cookie: true });
app.use((req, res, next) => {
  if (["POST", "PUT", "DELETE"].includes(req.method)) {
    return csrfProtection(req, res, next);
  }
  next();
});

// === Supabase и Redis ===
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const redisClient = createRedisClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(err => {
  console.error('[Redis] Ошибка подключения:', err);
});

// === Middleware авторизации ===
function verifyToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ success: false, error: 'Отсутствует токен авторизации' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ success: false, error: 'Недопустимый токен' });
  }
}

// === Безопасный маршрут для CSRF токена ===
app.get('/csrf-token', (req, res) => {
  try {
    const token = req.csrfToken();
    res.json({ csrfToken: token });
  } catch (err) {
    console.error('[csrf-token] Ошибка получения токена:', err.message);
    res.status(200).json({ csrfToken: '' });
  }
});

// === Пример защищенного маршрута ===
app.get('/user', verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { data, error } = await supabase.from('users').select('*').eq('user_id', userId).single();
    if (error) throw error;
    res.json({ success: true, user: data });
  } catch (err) {
    console.error('[user] Ошибка:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка получения пользователя' });
  }
});

// === Запуск сервера ===
app.listen(port, () => {
  console.log(`[Server] Запущен на порту ${port}`);
});

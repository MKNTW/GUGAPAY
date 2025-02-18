// server.js
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
require('dotenv').config();

// Инициализация Telegram-бота
const TelegramBot = require('node-telegram-bot-api');
// Используем предоставленный токен (можно также положить его в .env файл)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7889374104:AAHF4Lv7RjcFVl6n4D2dBMCJT0KGPz51kg8';
if (!TELEGRAM_BOT_TOKEN) {
  console.error('Ошибка: TELEGRAM_BOT_TOKEN не установлен');
  process.exit(1);
}
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_jwt_secret';

// Проверка переменных окружения для Supabase
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('[Supabase] Ошибка: отсутствует SUPABASE_URL или SUPABASE_KEY');
  process.exit(1);
}

// Инициализация Supabase-клиента
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Middleware
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: ['https://mkntw.ru'], // Замените на URL вашего сайта
  credentials: true,
  optionsSuccessStatus: 200
}));

// Rate limiting для критичных endpoint’ов
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 1000,
  message: 'Слишком много запросов с этого IP, попробуйте позже.'
});
app.use(['/login', '/register', '/merchantLogin'], authLimiter);

// Middleware для проверки JWT-токена
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

// Endpoint для выхода (logout)
app.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none'
  });
  res.json({ success: true, message: 'Вы вышли из системы' });
});

// Тестовый endpoint
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
        return res.status(409).json({ success: false, error: 'такой логин уже существует' });
      }
      return res.status(500).json({ success: false, error: supabaseError.message });
    }

    console.log('[Регистрация] Новый пользователь:', username, ' userId=', userId);
    res.json({ success: true, userId });
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
      return res.status(403).json({ success: false, error: 'аккаунт заблокирован' });
    }

    const isPassOk = await bcrypt.compare(password, data.password);
    if (!isPassOk) {
      return res.status(401).json({ success: false, error: 'Неверные данные пользователя' });
    }

    const token = jwt.sign({ userId: data.user_id, role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
    const env = process.env.NODE_ENV || 'development';
    res.cookie('token', token, {
      httpOnly: true,
      secure: env === 'production',
      sameSite: 'none',
      maxAge: 3600000
    });
    console.log('[Login] Пользователь вошёл:', username, ' userId=', data.user_id);
    res.json({ success: true, message: 'Пользователь успешно авторизован' });
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
      return res.status(404).json({ success: false, error: 'пользователь не найден' });
    }
    if (userData.blocked === 1) {
      return res.status(403).json({ success: false, error: 'аккаунт заблокирован' });
    }

    const newBalance = parseFloat(userData.balance || 0) + amount;
    const { error: updateErr } = await supabase
      .from('users')
      .update({ balance: newBalance.toFixed(5) })
      .eq('user_id', userId);
    if (updateErr) {
      return res.status(500).json({ success: false, error: 'не удалось обновить баланс' });
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
   5) GET /user (получить данные пользователя)
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
      return res.status(404).json({ success: false, error: 'пользователь не найден' });
    }
    if (userData.blocked === 1) {
      return res.status(403).json({ success: false, error: 'пользователь заблокирован' });
    }

    let halvingStep = 0;
    const { data: halvingData } = await supabase
      .from('halving')
      .select('halving_step')
      .limit(1);
    if (halvingData && halvingData.length > 0) {
      halvingStep = halvingData[0].halving_step;
    }
    res.json({
      success: true,
      user: {
        ...userData,
        halvingStep
      }
    });
  } catch (err) {
    console.error('[get /user] Ошибка:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

/* ========================
   6) POST /transfer (пользователь → пользователь)
======================== */
const transferSchema = Joi.object({
  toUserId: Joi.string().required(),
  amount: Joi.number().positive().required()
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
    const { toUserId, amount } = value;
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
    const { error: insertError } = await supabase
      .from('transactions')
      .insert([{
        from_user_id: fromUserId,
        to_user_id: toUserId,
        amount,
        type: 'sent'
      }]);
    if (insertError) {
      console.error('Ошибка вставки транзакции:', insertError);
      return res.status(500).json({ success: false, error: 'Ошибка записи транзакции' });
    }
    console.log(`[transfer] from=${fromUserId} to=${toUserId} amount=${amount}`);
    res.json({ success: true, fromBalance: newFromBalance, toBalance: newToBalance });
  } catch (err) {
    console.error('[transfer] Ошибка:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

/* ========================
   7) GET /transactions (история операций)
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
      .insert([{
        from_user_id: 'MERCHANT:' + merchantId,
        to_user_id: toUserId,
        amount,
        type: 'received'
      }]);
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
   10) POST /payMerchantOneTime (Пользователь оплачивает QR)
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
      .insert([{
        from_user_id: userId,
        to_user_id: 'MERCHANT:' + merchantId,
        amount,
        type: 'merchant_payment'
      }]);
    if (insertError) {
      console.error('Ошибка вставки транзакции для мерчанта:', insertError);
      return res.status(500).json({ success: false, error: 'Ошибка записи транзакции' });
    }
    
    await supabase
      .from('merchant_payments')
      .insert([{
        user_id: userId,
        merchant_id: merchantId,
        amount: merchantAmount,
        purpose
      }]);
      
    console.log(`[payMerchantOneTime] user=${userId} => merchant=${merchantId}, amount=${amount}, merchantGets=${merchantAmount}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[payMerchantOneTime] Ошибка:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера при оплате мерчанту' });
  }
});

/* ========================
   11) GET /merchantBalance
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
   13) POST /exchange (RUB ↔ COIN)
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
    const fee = 0.02;
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
   11) GET /exchangeRates
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
   12) POST /cloudtips/callback
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
      .insert([{
        order_id: orderId,
        user_id: userId,
        rub_amount: amount
      }]);
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
   13) GET /merchant/info
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
   14) НОВЫЙ ENDPOINT: POST /telegram/request-code
   Генерация одноразового кода для привязки Telegram
======================== */
app.post('/telegram/request-code', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ success: false, error: 'Доступ запрещён' });
    }
    const userId = req.user.userId;

    // Удаляем старые неиспользованные коды
    await supabase
      .from('telegram_verifications')
      .delete()
      .eq('user_id', userId)
      .eq('used', false);

    // Генерируем 6-значный код
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 минут

    const { error } = await supabase
      .from('telegram_verifications')
      .insert([{
        user_id: userId,
        code,
        used: false,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString()
      }]);
    if (error) {
      console.error('Ошибка вставки записи telegram_verifications:', error);
      return res.status(500).json({ success: false, error: 'Ошибка сохранения кода' });
    }

    // В production код лучше не возвращать клиенту
    return res.json({ success: true, message: 'Код сгенерирован. Отправьте его нашему Telegram-боту.' });
  } catch (err) {
    console.error('Ошибка /telegram/request-code:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

/* ========================
   15) Обработка входящих сообщений Telegram-бота
======================== */
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text ? msg.text.trim() : '';

  // Если текст не состоит ровно из 6 цифр, отправляем инструкцию
  if (!/^\d{6}$/.test(text)) {
    bot.sendMessage(chatId, 'Пожалуйста, отправьте корректный код подтверждения (6 цифр).');
    return;
  }

  const nowISO = new Date().toISOString();
  const { data, error } = await supabase
    .from('telegram_verifications')
    .select('*')
    .eq('code', text)
    .eq('used', false)
    .gt('expires_at', nowISO);

  if (error) {
    console.error('Ошибка запроса в telegram_verifications:', error);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте ещё раз.');
    return;
  }
  if (!data || data.length === 0) {
    bot.sendMessage(chatId, 'Неверный или просроченный код.');
    return;
  }

  const verification = data[0];
  const userId = verification.user_id;

  const { error: updateError } = await supabase
    .from('telegram_verifications')
    .update({ used: true, telegram_chat_id: chatId })
    .eq('id', verification.id);
  if (updateError) {
    console.error('Ошибка обновления записи telegram_verifications:', updateError);
    bot.sendMessage(chatId, 'Ошибка обновления данных. Попробуйте ещё раз.');
    return;
  }

  const { error: updateUserError } = await supabase
    .from('users')
    .update({ telegram_id: chatId })
    .eq('user_id', userId);
  if (updateUserError) {
    console.error('Ошибка обновления пользователя (telegram_id):', updateUserError);
    bot.sendMessage(chatId, 'Ошибка обновления пользователя. Попробуйте ещё раз.');
    return;
  }

  bot.sendMessage(chatId, 'Ваш Telegram успешно привязан к аккаунту!');
});

/* ========================
   Запуск сервера
======================== */
app.listen(port, '0.0.0.0', () => {
  console.log(`[Server] Запущен на порту ${port}`);
});

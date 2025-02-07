// server.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Проверка переменных окружения
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('[Supabase] Ошибка: отсутствует SUPABASE_URL или SUPABASE_KEY');
  process.exit(1);
}

// Подключение к Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Настройка CORS и парсинг JSON
app.use(cors());
app.use(express.json());

// Тестовый endpoint (главная)
app.get('/', (req, res) => {
  res.send('GugaCoin backend server (users + merchants + QR payments + rub_balance + Cloudtips).');
});

/* ========================
   1) РЕГИСТРАЦИЯ ПОЛЬЗОВАТЕЛЯ
======================== */
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'логин и пароль обязательны' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'пароль должен содержать минимум 6 символов' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = Math.floor(100000 + Math.random() * 900000).toString();

    // При создании пользователя инициализируем rub_balance: 0
    const { error } = await supabase
      .from('users')
      .insert([{
        username,
        password: hashedPassword,
        user_id: userId,
        balance: 0,
        rub_balance: 0,  // <-- добавлено
        blocked: 0
      }]);

    if (error) {
      if (error.message.includes('unique')) {
        return res.status(409).json({ success: false, error: 'такой логин уже существует' });
      }
      return res.status(500).json({ success: false, error: error.message });
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
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !data) {
      return res.status(401).json({ success: false, error: 'Неверные данные пользователя' });
    }
    if (data.blocked === 1) {
      return res.status(403).json({ success: false, error: 'аккаунт заблокирован' });
    }

    const isPassOk = await bcrypt.compare(password, data.password);
    if (!isPassOk) {
      return res.status(401).json({ success: false, error: 'Неверные данные пользователя' });
    }

    console.log('[Login] Пользователь вошёл:', username, ' userId=', data.user_id);
    res.json({ success: true, userId: data.user_id });
  } catch (err) {
    console.error('[login] Ошибка:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

/* ========================
   3) ЛОГИН МЕРЧАНТА
======================== */
app.post('/merchantLogin', async (req, res) => {
  try {
    const { username, password } = req.body;
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('merchant_login', username)
      .single();

    if (error || !data) {
      return res.status(401).json({ success: false, error: 'Неверные данные пользователя' });
    }
    if (data.blocked === 1) {
      return res.status(403).json({ success: false, error: 'аккаунт заблокирован' });
    }

    const isPassOk = await bcrypt.compare(password, data.merchant_password);
    if (!isPassOk) {
      return res.status(401).json({ success: false, error: 'Неверные данные пользователя' });
    }

    console.log('[MerchantLogin] Мерчант вошёл:', username, ' merchantId=', data.merchant_id);
    res.json({ success: true, merchantId: data.merchant_id });
  } catch (err) {
    console.error('[merchantLogin] Ошибка:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

/* ========================
   4) МАЙНИНГ (/update)
======================== */
app.post('/update', async (req, res) => {
  try {
    const { userId, amount = 0.00001 } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'ID пользователя обязателен' });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'неверная сумма' });
    }

    // Находим пользователя
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

    // Обновляем статистику halving
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
app.get('/user', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'ID пользователя обязателен' });
    }
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

    // Возвращаем и rub_balance
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
app.post('/transfer', async (req, res) => {
  try {
    const { fromUserId, toUserId, amount } = req.body;
    if (!fromUserId || !toUserId) {
      return res.status(400).json({ success: false, error: 'Не указан fromUserId/toUserId' });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Неверная сумма' });
    }
    if (fromUserId === toUserId) {
      return res.status(400).json({ success: false, error: 'Нельзя переводить самому себе' });
    }

    // Проверяем отправителя
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

    // Проверяем получателя
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

    // Обновляем балансы
    await supabase
      .from('users')
      .update({ balance: newFromBalance.toFixed(5) })
      .eq('user_id', fromUserId);
    await supabase
      .from('users')
      .update({ balance: newToBalance.toFixed(5) })
      .eq('user_id', toUserId);

    // Запись операции в таблицу transactions
    const { error: insertError } = await supabase
      .from('transactions')
      .insert([
        { 
          from_user_id: fromUserId, 
          to_user_id: toUserId, 
          amount, 
          type: 'sent'
        }
      ]);
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
app.get('/transactions', async (req, res) => {
  try {
    const { userId, merchantId } = req.query;
    if (!userId && !merchantId) {
      return res.status(400).json({ success: false, error: 'userId или merchantId обязателен' });
    }

    let allTransactions = [];
    if (userId) {
      // Получаем операции из таблицы transactions (where from_user_id or to_user_id)
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
  
      allTransactions = [...(sentTx || []), ...(receivedTx || [])];
    }
  
    if (merchantId) {
      // Если нужно объединить операции мерчанта (merchant_payments)
      const { data: merchantPayments, error: merchantError } = await supabase
        .from('merchant_payments')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false });
      if (merchantError) {
        return res.status(500).json({ success: false, error: 'Ошибка при получении транзакций мерчанта' });
      }
      const mappedMerchantTx = (merchantPayments || []).map(tx => ({ ...tx, type: 'merchant_payment' }));
      allTransactions = [ ...allTransactions, ...mappedMerchantTx ];
    }
  
    // Сортируем все транзакции по времени (от новой к старой)
    allTransactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
    res.json({ success: true, transactions: allTransactions });
  } catch (err) {
    console.error('[transactions] Ошибка:', err);
    res.status(500).json({ success: false, error: 'Ошибка при получении истории' });
  }
});

/* ========================
   9) POST /merchantTransfer (мерчант → пользователь)
======================== */
app.post('/merchantTransfer', async (req, res) => {
  try {
    const { merchantId, toUserId, amount } = req.body;
    if (!merchantId || !toUserId || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Неверные данные' });
    }
    const { data: merch } = await supabase
      .from('merchants')
      .select('*')
      .eq('merchant_id', merchantId)
      .single();
    if (!merch) {
      return res.status(404).json({ success: false, error: 'мерчант не найден' });
    }
    if (merch.blocked === 1) {
      return res.status(403).json({ success: false, error: 'аккаунт заблокирован' });
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
      return res.status(404).json({ success: false, error: 'пользователь не найден' });
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

    // Запись в таблицу transactions
    const { error: insertError } = await supabase
      .from('transactions')
      .insert([
        {
          from_user_id: 'MERCHANT:' + merchantId,
          to_user_id: toUserId,
          amount,
          type: 'received'
        }
      ]);
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
app.post('/payMerchantOneTime', async (req, res) => {
  try {
    const { userId, merchantId, amount, purpose = '' } = req.body;
    if (!userId || !merchantId || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Неверные данные для оплаты' });
    }
    // 1) Получаем пользователя
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
    // 2) Получаем мерчанта
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
    // 3) Списываем 100% у пользователя
    const newUserBalance = parseFloat(userData.balance) - amount;
    await supabase
      .from('users')
      .update({ balance: newUserBalance.toFixed(5) })
      .eq('user_id', userId);
    // 4) Зачисляем 95% мерчанту (5% комиссия)
    const merchantAmount = amount * 0.95;
    const newMerchantBalance = parseFloat(merchData.balance) + merchantAmount;
    await supabase
      .from('merchants')
      .update({ balance: newMerchantBalance.toFixed(5) })
      .eq('merchant_id', merchantId);
    // 5) Запись транзакции в transactions
    const { error: insertError } = await supabase
      .from('transactions')
      .insert([
        {
          from_user_id: userId,
          to_user_id: 'MERCHANT:' + merchantId,
          amount,
          type: 'merchant_payment'
        }
      ]);
    if (insertError) {
      console.error('Ошибка вставки транзакции для мерчанта:', insertError);
      return res.status(500).json({ success: false, error: 'Ошибка записи транзакции' });
    }
    // 6) Запись в merchant_payments
    await supabase
      .from('merchant_payments')
      .insert([
        {
          user_id: userId,
          merchant_id: merchantId,
          amount: merchantAmount,
          purpose
        }
      ]);

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
app.get('/merchantBalance', async (req, res) => {
  try {
    const { merchantId } = req.query;
    if (!merchantId) {
      return res.status(400).json({ success: false, error: 'merchantId обязателен' });
    }
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
   12) GET /halvingInfo
======================== */
app.get('/halvingInfo', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('halving')
      .select('*')
      .limit(1);
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    if (data && data.length > 0) {
      res.json({ success: true, halvingStep: data[0].halving_step || 0 });
    } else {
      res.json({ success: true, halvingStep: 0 });
    }
  } catch (err) {
    console.error('[halvingInfo] Ошибка:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

/* ========================
   13) POST /exchange (RUB ↔ COIN)
======================== */
app.post('/exchange', async (req, res) => {
  try {
    const { userId, direction, amount } = req.body;
    if (!userId || !direction || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Неверные данные' });
    }
    // Получаем данные пользователя (rub_balance, balance и т.п.)
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

    // Получаем halvingStep
    let halvingStep = 0;
    const { data: halvingData } = await supabase
      .from('halving')
      .select('halving_step')
      .limit(1);
    if (halvingData && halvingData.length > 0) {
      halvingStep = halvingData[0].halving_step;
    }
    // Курс: 1₲ = (1 + halvingStep * 0.02) ₽
    const rubMultiplier = 1 + halvingStep * 0.02;

    const currentRub = parseFloat(user.rub_balance || 0);
    const currentCoin = parseFloat(user.balance || 0);

    if (direction === 'rub_to_coin') {
      // Проверяем, хватает ли рублей
      if (currentRub < amount) {
        return res.status(400).json({ success: false, error: 'Недостаточно рублей' });
      }
      // Сколько монет получим
      const coinAmount = amount / rubMultiplier;
      const newRubBalance = currentRub - amount;
      const newCoinBalance = currentCoin + coinAmount;

      const { error: updateErr } = await supabase
        .from('users')
        .update({
          rub_balance: newRubBalance.toFixed(2),
          balance: newCoinBalance.toFixed(5)
        })
        .eq('user_id', userId);
      if (updateErr) {
        return res.status(500).json({ success: false, error: 'Ошибка обновления баланса' });
      }
      return res.json({
        success: true,
        newRubBalance: newRubBalance.toFixed(2),
        newCoinBalance: newCoinBalance.toFixed(5)
      });
    } else if (direction === 'coin_to_rub') {
      // Проверяем, хватает ли монет
      if (currentCoin < amount) {
        return res.status(400).json({ success: false, error: 'Недостаточно монет' });
      }
      // Сколько рублей получим
      const rubAmount = amount * rubMultiplier;
      const newCoinBalance = currentCoin - amount;
      const newRubBalance = currentRub + rubAmount;

      const { error: updateErr } = await supabase
        .from('users')
        .update({
          rub_balance: newRubBalance.toFixed(2),
          balance: newCoinBalance.toFixed(5)
        })
        .eq('user_id', userId);
      if (updateErr) {
        return res.status(500).json({ success: false, error: 'Ошибка обновления баланса' });
      }
      return res.json({
        success: true,
        newRubBalance: newRubBalance.toFixed(2),
        newCoinBalance: newCoinBalance.toFixed(5)
      });
    } else {
      return res.status(400).json({ success: false, error: 'Неверное направление обмена' });
    }
  } catch (err) {
    console.error('[exchange] Ошибка:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

/* ========================
   14) POST /cloudtips/callback
   - Принимает уведомление об успешной оплате
   - В comment пользователь сам указал "123456" (userId)
======================== */
app.post('/cloudtips/callback', async (req, res) => {
  try {
    const { orderId, status, amount, comment } = req.body;
    // Проверка статуса
    if (status !== 'success') {
      return res.status(400).json({ success: false, error: 'Платеж неуспешен' });
    }
    // Пытаемся извлечь userId из комментария
    // Например, пользователь мог просто ввести "123456" или "Мой userId: 123456"
    const userIdRegex = /(\d+)/; // Ищем любое число
    const match = comment?.match(userIdRegex);
    if (!match) {
      return res.status(400).json({ success: false, error: 'userId не найден в комментарии' });
    }
    const userId = match[1];

    // Ищем пользователя
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

    // Обновляем rub_balance
    const currentRubBalance = parseFloat(user.rub_balance || 0);
    const newRubBalance = (currentRubBalance + parseFloat(amount)).toFixed(2);

    const { error: updateErr } = await supabase
      .from('users')
      .update({ rub_balance: newRubBalance })
      .eq('user_id', userId);
    if (updateErr) {
      return res.status(500).json({ success: false, error: 'Не удалось обновить баланс' });
    }

    // Запись в cloudtips_transactions
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
   ЗАПУСК СЕРВЕРА
======================== */
app.listen(port, '0.0.0.0', () => {
  console.log(`[Server] Запущен на порту ${port}`);
});

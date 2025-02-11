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
      // Получаем операции из таблицы transactions (отправленные и полученные)
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
  
      // Для операций из таблицы transactions используем created_at как display_time
      allTransactions = [
        ...(sentTx || []).map(tx => ({ ...tx, display_time: tx.created_at })),
        ...(receivedTx || []).map(tx => ({ ...tx, display_time: tx.created_at }))
      ];
    }
  
    if (merchantId) {
      // Получаем операции мерчанта
      const { data: merchantPayments, error: merchantError } = await supabase
        .from('merchant_payments')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false });
      if (merchantError) {
        return res.status(500).json({ success: false, error: 'Ошибка при получении транзакций мерчанта' });
      }
      const mappedMerchantTx = (merchantPayments || []).map(tx => ({
        ...tx,
        type: 'merchant_payment',
        display_time: tx.created_at
      }));
      allTransactions = [ ...allTransactions, ...mappedMerchantTx ];
    }
  
    // Получаем операции обмена валюты (тип exchange)
    // Если у транзакции было передано клиентское время, сортируем по нему
    const { data: exchangeTx, error: exchangeError } = await supabase
      .from('exchange_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('client_time', { ascending: false });
      
    if (exchangeError) {
      console.error('Ошибка при получении операций обмена:', exchangeError);
    } else {
      const mappedExchangeTx = (exchangeTx || []).map(tx => ({
        ...tx,
        type: 'exchange',
        // Если поле client_time присутствует, используем его, иначе created_at
        display_time: tx.client_time || tx.created_at
      }));
      allTransactions = [...allTransactions, ...mappedExchangeTx];
    }

    // Сортируем все транзакции по display_time (от более новой к более старой)
    allTransactions.sort((a, b) => new Date(b.display_time) - new Date(a.display_time));

    console.log('Transactions:', allTransactions); // Логируем итоговый список транзакций

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
    const merchantAmount = amount * 1;
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
   13) POST /exchange (RUB ↔ COIN)
======================== */
// Глобальные константы для модели AMM
let netDemand = 0;  // Если вы планируете комбинировать модель с динамикой пула, можно использовать netDemand (опционально)
const BASE_EXCHANGE_RATE = 0.5;  // Базовый курс (на случай дополнительных корректировок, но в данном случае курс рассчитывается из пула)
const fee = 0.03;  // 3% комиссия

app.post('/exchange', async (req, res) => {
  try {
    const { userId, direction, amount } = req.body;
    if (!userId || !direction || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Неверные данные' });
    }
    
    // Получаем данные пользователя
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
    
    // Получаем данные пула ликвидности (предполагаем, что id = 1)
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
    
    if (direction === 'rub_to_coin') {
      const userRub = parseFloat(userData.rub_balance || 0);
      if (userRub < amount) {
        return res.status(400).json({ success: false, error: 'Недостаточно рублей' });
      }
      // Применяем комиссию
      const effectiveRub = amount * (1 - fee);
      // Модель constant product:
      outputAmount = reserveCoin - (reserveCoin * reserveRub) / (reserveRub + effectiveRub);
      if (outputAmount <= 0) {
        return res.status(400).json({ success: false, error: 'Невозможно выполнить обмен' });
      }
      newReserveRub = reserveRub + effectiveRub;
      newReserveCoin = reserveCoin - outputAmount;
      
      // Обновляем баланс пользователя
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
    
    // Ограничиваем курс: newExchangeRate = newReserveRub / newReserveCoin
    const newExchangeRate = newReserveRub / newReserveCoin;
    if (newExchangeRate < 0.1) {
      return res.status(400).json({ success: false, error: 'Обмен невозможен: курс не может опуститься ниже 0.1' });
    }
    
    // Обновляем данные пула ликвидности
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
    
    // Записываем операцию обмена в exchange_transactions
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
    
    // Записываем текущий курс в историю (exchange_rate_history)
    const rateValue = Number(currentExchangeRate.toFixed(5));
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
 Эндпоинт /exchangeRates
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

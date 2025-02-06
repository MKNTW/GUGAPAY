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

// Настройка CORS
const corsOptions = {
  origin: '*', // Разрешаем запросы от всех доменов
  methods: 'GET,POST,PUT,DELETE,OPTIONS',
  allowedHeaders: 'Content-Type,Authorization'
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Обработка предварительных OPTIONS-запросов

// Middleware для обработки JSON
app.use(express.json());

// Главная страница (тестовый ответ)
app.get('/', (req, res) => {
  res.send(`
    <p>This is the backend server for GUGACOIN (users + merchants).</p>
  `);
});

/* =============================
   РЕГИСТРАЦИЯ ПОЛЬЗОВАТЕЛЯ
============================= */
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
    // Генерируем 6-значный userId
    const userId = Math.floor(100000 + Math.random() * 900000).toString();

    // Добавляем поле blocked со значением 0 (не заблокирован)
    const { error } = await supabase
      .from('users')
      .insert([{ username, password: hashedPassword, user_id: userId, balance: 0, blocked: 0 }]);

    if (error) {
      // Если ошибка связана с нарушением уникальности (логин уже существует)
      if (error.message.includes('unique_violation')) {
        return res.status(409).json({ success: false, error: 'такой логин уже существует' });
      }
      return res.status(500).json({ success: false, error: error.message });
    }

    console.log(`[Регистрация] Новый пользователь: ${username}`);
    res.json({ success: true, userId });
  } catch (error) {
    console.error('[Регистрация] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

/* =============================
   ЛОГИН ПОЛЬЗОВАТЕЛЯ
============================= */
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !data) {
      return res.status(401).json({ success: false, error: 'неверные учетные данные' });
    }

    if (data.blocked === 1) {
      return res.status(403).json({ success: false, error: 'аккаунт заблокирован' });
    }

    const isPasswordValid = await bcrypt.compare(password, data.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, error: 'неверные учетные данные' });
    }

    console.log(`[Login] Пользователь вошёл: ${username}`);
    res.json({ success: true, userId: data.user_id });
  } catch (error) {
    console.error('[Login] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'ошибка сервера' });
  }
});

/* =============================
   ЛОГИН МЕРЧАНТА
============================= */
/*
   Мерчант хранится в таблице merchants с полями:
   - merchant_id (unique)
   - merchant_login (unique)
   - merchant_password (bcrypt)
   - blocked (0 или 1)
*/
app.post('/merchantLogin', async (req, res) => {
  try {
    const { username, password } = req.body; // Логин и пароль мерчанта приходят в тех же полях
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'логин и пароль мерчанта обязательны' });
    }
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('merchant_login', username)
      .single();

    if (error || !data) {
      return res.status(401).json({ success: false, error: 'неверные учетные данные мерчанта' });
    }
    if (data.blocked === 1) {
      return res.status(403).json({ success: false, error: 'мерчант заблокирован' });
    }

    const isPasswordValid = await bcrypt.compare(password, data.merchant_password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, error: 'неверные учетные данные мерчанта' });
    }

    console.log(`[MerchantLogin] Мерчант вошёл: ${username}, merchantId=${data.merchant_id}`);
    // Возвращаем merchantId
    res.json({ success: true, merchantId: data.merchant_id });
  } catch (error) {
    console.error('[MerchantLogin] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'ошибка сервера' });
  }
});

/* =============================
   МАЙНИНГ (обновление баланса пользователя)
============================= */
app.post('/update', async (req, res) => {
  try {
    const { userId, amount = 0.00001 } = req.body;
    console.log('[Update] Получен запрос:', { userId, amount });
    if (!userId) {
      return res.status(400).json({ success: false, error: 'ID пользователя обязателен' });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'неверная сумма' });
    }

    // Получаем текущий баланс пользователя
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (fetchError || !userData) {
      return res.status(404).json({ success: false, error: 'пользователь не найден' });
    }

    // Вычисляем новый баланс с точностью до 5 знаков
    const newBalance = parseFloat((userData.balance || 0) + amount).toFixed(5);

    // Обновляем баланс пользователя
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('user_id', userId);

    if (updateError) {
      return res.status(500).json({ success: false, error: 'обновление баланса не удалось' });
    }

    // Обновляем таблицу halving (общая статистика)
    const { data: halvingData, error: halvingError } = await supabase
      .from('halving')
      .select('*')
      .limit(1);

    let newTotalMined = amount;
    if (!halvingError && halvingData && halvingData.length > 0) {
      newTotalMined = parseFloat(halvingData[0].total_mined || 0) + amount;
    }
    const newHalvingStep = Math.floor(newTotalMined);

    const { error: upsertError } = await supabase
      .from('halving')
      .upsert([{ total_mined: newTotalMined, halving_step: newHalvingStep }]);

    if (upsertError) {
      console.error('[Update] Ошибка обновления halving:', upsertError.message);
    }

    console.log('[Update] Баланс обновлён:', newBalance, 'total_mined:', newTotalMined, 'halving_step:', newHalvingStep);
    res.json({ success: true, balance: newBalance, halvingStep: newHalvingStep });
  } catch (error) {
    console.error('[Update] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'внутренняя ошибка сервера' });
  }
});

/* =============================
   ДАННЫЕ О ПОЛЬЗОВАТЕЛЕ
============================= */
app.get('/user', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'ID пользователя обязателен' });
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'пользователь не найден' });
    }
    if (data.blocked === 1) {
      return res.status(403).json({ success: false, error: 'пользователь заблокирован' });
    }

    // Узнаём halving_step (не обязательно)
    let halvingStep = 0;
    const { data: halvingData } = await supabase
      .from('halving')
      .select('halving_step')
      .limit(1);

    if (halvingData && halvingData.length > 0) {
      halvingStep = halvingData[0].halving_step;
    }

    console.log(`[User] Данные получены для пользователя: ${userId}`);
    res.json({ success: true, user: { ...data, halvingStep } });
  } catch (error) {
    console.error('[User] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'не удалось получить данные пользователя' });
  }
});

/* =============================
   ПЕРЕВОД МОНЕТ МЕЖДУ ПОЛЬЗОВАТЕЛЯМИ
============================= */
app.post('/transfer', async (req, res) => {
  try {
    const { fromUserId, toUserId, amount } = req.body;
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'неверная сумма' });
    }
    if (fromUserId === toUserId) {
      return res.status(400).json({ success: false, error: 'вы не можете перевести монеты самому себе' });
    }

    // Проверяем отправителя
    const { data: fromUser } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', fromUserId)
      .single();
    if (!fromUser) {
      return res.status(404).json({ success: false, error: 'отправитель не найден' });
    }
    if ((fromUser.balance || 0) < amount) {
      return res.status(400).json({ success: false, error: 'недостаточно средств' });
    }

    // Проверяем получателя
    const { data: toUser } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', toUserId)
      .single();
    if (!toUser) {
      return res.status(404).json({ success: false, error: 'получатель не найден' });
    }

    const newFromBalance = parseFloat((fromUser.balance || 0) - amount).toFixed(5);
    const newToBalance = parseFloat((toUser.balance || 0) + amount).toFixed(5);

    // Обновляем баланс отправителя
    await supabase
      .from('users')
      .update({ balance: newFromBalance })
      .eq('user_id', fromUserId);

    // Обновляем баланс получателя
    await supabase
      .from('users')
      .update({ balance: newToBalance })
      .eq('user_id', toUserId);

    // Записываем транзакцию
    await supabase
      .from('transactions')
      .insert([{ from_user_id: fromUserId, to_user_id: toUserId, amount }]);

    console.log(`[Transfer] ${amount} монет от ${fromUserId} к ${toUserId}`);
    res.json({ success: true, fromBalance: newFromBalance, toBalance: newToBalance });
  } catch (error) {
    console.error('[Transfer] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'перевод не удался' });
  }
});

/* =============================
   ИСТОРИЯ ТРАНЗАКЦИЙ
============================= */
app.get('/transactions', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'ID пользователя обязателен' });
    }

    // Получаем исходящие транзакции
    const { data: sentTx } = await supabase
      .from('transactions')
      .select('*')
      .eq('from_user_id', userId)
      .order('created_at', { ascending: false });

    // Получаем входящие транзакции
    const { data: receivedTx } = await supabase
      .from('transactions')
      .select('*')
      .eq('to_user_id', userId)
      .order('created_at', { ascending: false });

    const allTransactions = [
      ...(sentTx || []).map(tx => ({ ...tx, type: 'sent' })),
      ...(receivedTx || []).map(tx => ({ ...tx, type: 'received' }))
    ];

    // Сортируем по дате (самые свежие сверху)
    allTransactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ success: true, transactions: allTransactions });
  } catch (error) {
    console.error('[Transactions] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'не удалось получить транзакции' });
  }
});

/* =============================
   ЗАПУСК СЕРВЕРА
============================= */
app.listen(port, '0.0.0.0', () => {
  console.log(`[Server] Запущен на http://localhost:${port}`);
});

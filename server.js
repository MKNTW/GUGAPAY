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

// Главная страница
app.get('/', (req, res) => {
  res.send(`
    <p>Backend server for GUGACOIN (with merchant logins + QR payments).</p>
  `);
});

/* =======================================================
   1. АВТОРИЗАЦИЯ ПОЛЬЗОВАТЕЛЕЙ (как и раньше)
========================================================= */
// Регистрация обычного пользователя
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
      if (error.message.includes('unique_violation')) {
        return res.status(409).json({ success: false, error: 'такой логин уже существует' });
      }
      return res.status(500).json({ success: false, error: error.message });
    }

    console.log(`[Регистрация] Новый пользователь: ${username}`);
    res.json({ success: true, userId });
  } catch (error) {
    console.error('[Регистрация] Ошибка:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Логин обычного пользователя
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
    console.error('[Login] Ошибка:', error);
    res.status(500).json({ success: false, error: 'ошибка сервера' });
  }
});

/* =======================================================
   2. АВТОРИЗАЦИЯ МЕРЧАНТОВ
========================================================= */
// (Опционально) Создание мерчанта (может быть админ-эндпоинт)
app.post('/createMerchant', async (req, res) => {
  try {
    const { merchantName, merchantLogin, merchantPassword } = req.body;
    if (!merchantName || !merchantLogin || !merchantPassword) {
      return res.status(400).json({ success: false, error: 'merchantName, merchantLogin, merchantPassword обязательны' });
    }
    // Генерируем 6-значный ID мерчанта
    const merchantId = Math.floor(100000 + Math.random() * 900000).toString();

    // Хэшируем пароль
    const hashedPassword = await bcrypt.hash(merchantPassword, 10);

    // Создаём запись в таблице
    const { error } = await supabase
      .from('merchants')
      .insert([
        {
          merchant_id: merchantId,
          merchant_name: merchantName,
          merchant_login: merchantLogin,
          merchant_password: hashedPassword,
          qr_code: ''
        }
      ]);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.json({ success: true, merchantId });
  } catch (error) {
    console.error('[createMerchant] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Логин мерчанта
app.post('/merchantLogin', async (req, res) => {
  try {
    const { merchantLogin, merchantPassword } = req.body;
    if (!merchantLogin || !merchantPassword) {
      return res.status(400).json({ success: false, error: 'логин и пароль мерчанта обязательны' });
    }
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('merchant_login', merchantLogin)
      .single();

    if (error || !data) {
      return res.status(401).json({ success: false, error: 'неверные учетные данные мерчанта' });
    }
    if (data.blocked === 1) {
      return res.status(403).json({ success: false, error: 'мерчант заблокирован' });
    }

    const isPasswordValid = await bcrypt.compare(merchantPassword, data.merchant_password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, error: 'неверные учетные данные мерчанта' });
    }

    console.log(`[MerchantLogin] Мерчант вошёл: ${merchantLogin}, merchantId=${data.merchant_id}`);
    // Возвращаем merchantId, чтобы клиент мог его использовать
    res.json({ success: true, merchantId: data.merchant_id });
  } catch (error) {
    console.error('[MerchantLogin] Ошибка:', error);
    res.status(500).json({ success: false, error: 'ошибка сервера' });
  }
});

/* =======================================================
   3. Майнинг, юзер-операции, мерчант-операции
========================================================= */
// Обновление баланса (добыча)
app.post('/update', async (req, res) => {
  try {
    const { userId, amount = 0.00001 } = req.body;
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

    const newBalance = parseFloat((userData.balance || 0) + amount).toFixed(5);

    // Обновляем баланс пользователя
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('user_id', userId);

    if (updateError) {
      return res.status(500).json({ success: false, error: 'обновление баланса не удалось' });
    }

    // Обновляем глобальную статистику по халвингу (пример из предыдущего кода)
    const { data: halvingData } = await supabase
      .from('halving')
      .select('*')
      .limit(1);

    let newTotalMined = amount;
    if (halvingData && halvingData.length > 0) {
      newTotalMined = parseFloat(halvingData[0].total_mined || 0) + amount;
    }
    const newHalvingStep = Math.floor(newTotalMined);

    await supabase
      .from('halving')
      .upsert([{ total_mined: newTotalMined, halving_step: newHalvingStep }]);

    res.json({ success: true, balance: newBalance, halvingStep: newHalvingStep });
  } catch (error) {
    console.error('[Update] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'внутренняя ошибка сервера' });
  }
});

// Получение данных пользователя
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

    // Получаем данные по халвингу
    let halvingStep = 0;
    const { data: halvingData } = await supabase
      .from('halving')
      .select('halving_step')
      .limit(1);

    if (halvingData && halvingData.length > 0) {
      halvingStep = halvingData[0].halving_step;
    }
    res.json({ success: true, user: { ...data, halvingStep } });
  } catch (error) {
    console.error('[User] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'не удалось получить данные пользователя' });
  }
});

// Трансфер монет между двумя пользователями
app.post('/transfer', async (req, res) => {
  try {
    const { fromUserId, toUserId, amount } = req.body;
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'неверная сумма' });
    }
    if (fromUserId === toUserId) {
      return res.status(400).json({ success: false, error: 'нельзя перевести самому себе' });
    }

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

    await supabase
      .from('users')
      .update({ balance: newFromBalance })
      .eq('user_id', fromUserId);
    await supabase
      .from('users')
      .update({ balance: newToBalance })
      .eq('user_id', toUserId);

    // Записываем транзакцию в таблицу transactions
    await supabase
      .from('transactions')
      .insert([
        {
          from_user_id: fromUserId,
          to_user_id: toUserId,
          amount: amount
        }
      ]);

    res.json({ success: true, fromBalance: newFromBalance, toBalance: newToBalance });
  } catch (error) {
    console.error('[Transfer] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'перевод не удался' });
  }
});

// Оплата мерчанту
app.post('/payMerchant', async (req, res) => {
  try {
    const { userId, merchantId, amount, purpose = '' } = req.body;
    if (!userId || !merchantId || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Неверные данные для оплаты мерчанту' });
    }

    // Проверяем, что пользователь существует и у него хватает баланса
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (!userData) {
      return res.status(404).json({ success: false, error: 'пользователь не найден' });
    }
    if ((userData.balance || 0) < amount) {
      return res.status(400).json({ success: false, error: 'недостаточно средств' });
    }

    // Проверяем мерчанта
    const { data: merchantData } = await supabase
      .from('merchants')
      .select('*')
      .eq('merchant_id', merchantId)
      .single();
    if (!merchantData) {
      return res.status(404).json({ success: false, error: 'мерчант не найден' });
    }
    if (merchantData.blocked === 1) {
      return res.status(403).json({ success: false, error: 'мерчант заблокирован' });
    }

    // Списываем у пользователя
    const newUserBalance = parseFloat((userData.balance || 0) - amount).toFixed(5);
    await supabase
      .from('users')
      .update({ balance: newUserBalance })
      .eq('user_id', userId);

    // (Опционально) Если хотите вести баланс самого мерчанта, делаем схожее обновление.
    // Но в примере просто фиксируем операцию в merchant_payments

    // Записываем операцию в merchant_payments
    await supabase
      .from('merchant_payments')
      .insert([{ user_id: userId, merchant_id: merchantId, amount, purpose }]);

    res.json({ success: true, balance: newUserBalance });
  } catch (error) {
    console.error('[PayMerchant] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'ошибка при оплате мерчанту' });
  }
});

// История операций (обычные + мерчант)
app.get('/transactions', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'ID пользователя обязателен' });
    }

    // Обычные транзакции
    const { data: sentTransactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('from_user_id', userId)
      .order('created_at', { ascending: false });
    const { data: receivedTransactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('to_user_id', userId)
      .order('created_at', { ascending: false });

    // Мерчант-транзакции
    const { data: merchantPayments } = await supabase
      .from('merchant_payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const normalTx = [
      ...(sentTransactions || []).map(tx => ({ ...tx, type: 'sent' })),
      ...(receivedTransactions || []).map(tx => ({ ...tx, type: 'received' }))
    ];
    const merchantTx = (merchantPayments || []).map(mp => ({
      ...mp,
      type: 'merchant'
    }));

    const allTx = [...normalTx, ...merchantTx].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ success: true, transactions: allTx });
  } catch (error) {
    console.error('[Transactions] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'не удалось получить транзакции' });
  }
});

// Запуск сервера
app.listen(port, '0.0.0.0', () => {
  console.log(`[Server] Запущен на http://localhost:${port}`);
});

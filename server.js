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
    <p>This is the backend server for GUGACOIN with merchant QR-payments.</p>
  `);
});

/* ============= РЕГИСТРАЦИЯ ПОЛЬЗОВАТЕЛЯ ============= */
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
      return res.status(500).json({ success: false, error: 'такой логин уже существует или другая ошибка' });
    }

    console.log(`[Регистрация] Новый пользователь: ${username}`);
    res.json({ success: true, userId });
  } catch (error) {
    console.error('[Регистрация] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

/* ============= ЛОГИН ============= */
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

    // Если аккаунт заблокирован, возвращаем ошибку
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

/* ============= ОБНОВЛЕНИЕ БАЛАНСА (МАЙНИНГ) ============= */
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

    // Вычисляем новый баланс
    const newBalance = parseFloat((userData.balance || 0) + amount).toFixed(5);

    // Обновляем баланс пользователя
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('user_id', userId);

    if (updateError) {
      return res.status(500).json({ success: false, error: 'обновление баланса не удалось' });
    }

    // Обновляем глобальную статистику (halving)
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
      console.error('[Update] Ошибка обновления данных по халвингу:', upsertError.message);
    }

    console.log('[Update] Баланс обновлён успешно:', newBalance, 'Общий добытый:', newTotalMined, 'Халвинг:', newHalvingStep);
    res.json({ success: true, balance: newBalance, halvingStep: newHalvingStep });
  } catch (error) {
    console.error('[Update] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'внутренняя ошибка сервера' });
  }
});

/* ============= ПОЛУЧЕНИЕ ДАННЫХ ПОЛЬЗОВАТЕЛЯ ============= */
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
    const { data: halvingData, error: halvingError } = await supabase
      .from('halving')
      .select('halving_step')
      .limit(1);
    if (!halvingError && halvingData && halvingData.length > 0) {
      halvingStep = halvingData[0].halving_step;
    }

    console.log(`[User] Данные получены для пользователя: ${userId}`);
    res.json({ success: true, user: { ...data, halvingStep } });
  } catch (error) {
    console.error('[User] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'не удалось получить данные пользователя' });
  }
});

/* ============= ПЕРЕВОД МЕЖДУ ПОЛЬЗОВАТЕЛЯМИ ============= */
app.post('/transfer', async (req, res) => {
  try {
    const { fromUserId, toUserId, amount } = req.body;
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'неверная сумма' });
    }
    if (fromUserId === toUserId) {
      return res.status(400).json({ success: false, error: 'нельзя перевести самому себе' });
    }

    // Проверяем отправителя
    const { data: fromUser, error: fromError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', fromUserId)
      .single();
    if (fromError || !fromUser) {
      return res.status(404).json({ success: false, error: 'отправитель не найден' });
    }
    if ((fromUser.balance || 0) < amount) {
      return res.status(400).json({ success: false, error: 'недостаточно средств' });
    }

    // Проверяем получателя
    const { data: toUser, error: toError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', toUserId)
      .single();
    if (toError || !toUser) {
      return res.status(404).json({ success: false, error: 'получатель не найден' });
    }

    const newFromBalance = parseFloat((fromUser.balance || 0) - amount).toFixed(5);
    const newToBalance = parseFloat((toUser.balance || 0) + amount).toFixed(5);

    // Обновляем баланс отправителя
    const { error: updateFromError } = await supabase
      .from('users')
      .update({ balance: newFromBalance })
      .eq('user_id', fromUserId);
    if (updateFromError) {
      return res.status(500).json({ success: false, error: 'ошибка обновления баланса отправителя' });
    }

    // Обновляем баланс получателя
    const { error: updateToError } = await supabase
      .from('users')
      .update({ balance: newToBalance })
      .eq('user_id', toUserId);
    if (updateToError) {
      return res.status(500).json({ success: false, error: 'ошибка обновления баланса получателя' });
    }

    // Записываем транзакцию
    console.log('[Transfer] Запись транзакции:', { fromUserId, toUserId, amount });
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert([
        {
          from_user_id: fromUserId,
          to_user_id: toUserId,
          amount: amount
        }
      ]);
    if (transactionError) {
      return res.status(500).json({ success: false, error: 'не удалось записать транзакцию' });
    }

    console.log(`[Transfer] Перевод ${amount} монет от ${fromUserId} к ${toUserId} выполнен успешно`);
    res.json({ success: true, fromBalance: newFromBalance, toBalance: newToBalance });
  } catch (error) {
    console.error('[Transfer] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'перевод не удался' });
  }
});

/* ============= НОВЫЕ ЭНДПОИНТЫ ДЛЯ МЕРЧАНТОВ ============= */

/* 
   (ОПЦИОНАЛЬНО) Создание мерчанта — 
   на практике мерчант мог бы зарегистрироваться самостоятельно, 
   но даём пример эндпоинта, который создаст мерчанта и сгенерирует merchant_id.
*/
app.post('/createMerchant', async (req, res) => {
  try {
    const { merchantName } = req.body;
    if (!merchantName) {
      return res.status(400).json({ success: false, error: 'Имя мерчанта обязательно' });
    }
    // Генерируем 6-значный ID мерчанта
    const merchantId = Math.floor(100000 + Math.random() * 900000).toString();

    // Создаём запись в таблице
    const { error } = await supabase
      .from('merchants')
      .insert([{ merchant_id: merchantId, merchant_name: merchantName, qr_code: '' }]);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.json({ success: true, merchantId });
  } catch (error) {
    console.error('[createMerchant] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

/*
   (ОПЦИОНАЛЬНО) Эндпоинт для сохранения готового QR-кода,
   если мерчант генерирует его сам (например, qr_code = 'guga://merchantId=123456')
*/
app.post('/saveMerchantQR', async (req, res) => {
  try {
    const { merchantId, qrCode } = req.body;
    if (!merchantId || !qrCode) {
      return res.status(400).json({ success: false, error: 'merchantId и qrCode обязательны' });
    }
    const { error } = await supabase
      .from('merchants')
      .update({ qr_code: qrCode })
      .eq('merchant_id', merchantId);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('[saveMerchantQR] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

/* 
   Оплата мерчанту по merchant_id.
   Получаем userId, merchantId, amount, purpose. 
   Снимаем у пользователя средства, прибавляем мерчанту (можно также хранить баланс мерчанта в таблице merchants).
   Записываем операцию в merchant_payments, чтобы не смешивать с обычными транзакциями.
*/
app.post('/payMerchant', async (req, res) => {
  try {
    const { userId, merchantId, amount, purpose = '' } = req.body;
    if (!userId || !merchantId || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Неверные данные для оплаты мерчанту' });
    }

    // Проверяем, что пользователь существует и у него хватает баланса
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (userError || !userData) {
      return res.status(404).json({ success: false, error: 'пользователь не найден' });
    }
    if ((userData.balance || 0) < amount) {
      return res.status(400).json({ success: false, error: 'недостаточно средств' });
    }

    // Проверяем мерчанта
    const { data: merchantData, error: merchantError } = await supabase
      .from('merchants')
      .select('*')
      .eq('merchant_id', merchantId)
      .single();

    if (merchantError || !merchantData) {
      return res.status(404).json({ success: false, error: 'мерчант не найден' });
    }
    if (merchantData.blocked === 1) {
      return res.status(403).json({ success: false, error: 'мерчант заблокирован' });
    }

    // Обновляем баланс пользователя
    const newUserBalance = parseFloat((userData.balance || 0) - amount).toFixed(5);
    const { error: updateUserErr } = await supabase
      .from('users')
      .update({ balance: newUserBalance })
      .eq('user_id', userId);

    if (updateUserErr) {
      return res.status(500).json({ success: false, error: 'не удалось списать средства у пользователя' });
    }

    // (Опционально) Если хотите вести баланс самого мерчанта (как у пользователя):
    // const newMerchantBalance = parseFloat((merchantData.balance || 0) + amount).toFixed(5);
    // const { error: updateMerchantErr } = await supabase
    //   .from('merchants')
    //   .update({ balance: newMerchantBalance })
    //   .eq('merchant_id', merchantId);
    // if (updateMerchantErr) {
    //   return res.status(500).json({ success: false, error: 'не удалось зачислить средства мерчанту' });
    // }

    // Записываем в merchant_payments
    const { error: paymentError } = await supabase
      .from('merchant_payments')
      .insert([{ user_id: userId, merchant_id: merchantId, amount, purpose }]);
    if (paymentError) {
      return res.status(500).json({ success: false, error: 'не удалось записать оплату мерчанту' });
    }

    console.log(`[PayMerchant] Пользователь ${userId} оплатил мерчанту ${merchantId} сумму ${amount}`);
    res.json({ success: true, balance: newUserBalance });
  } catch (error) {
    console.error('[PayMerchant] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'ошибка при оплате мерчанту' });
  }
});

/* ============= ПОЛУЧЕНИЕ ИСТОРИИ ТРАНЗАКЦИЙ ============= */
app.get('/transactions', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'ID пользователя обязателен' });
    }

    // Обычные транзакции (между пользователями)
    const { data: sentTransactions, error: sentError } = await supabase
      .from('transactions')
      .select('*')
      .eq('from_user_id', userId)
      .order('created_at', { ascending: false });

    const { data: receivedTransactions, error: receivedError } = await supabase
      .from('transactions')
      .select('*')
      .eq('to_user_id', userId)
      .order('created_at', { ascending: false });

    if (sentError || receivedError) {
      return res.status(500).json({ success: false, error: 'не удалось получить транзакции' });
    }

    // Мерчант-транзакции (где user_id совпадает)
    const { data: merchantPayments, error: merchantError } = await supabase
      .from('merchant_payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (merchantError) {
      return res.status(500).json({ success: false, error: 'не удалось получить оплаты мерчантам' });
    }

    // Объединяем обычные + мерчант-операции в один список
    const normalTx = [
      ...(sentTransactions || []).map(tx => ({ ...tx, type: 'sent' })),
      ...(receivedTransactions || []).map(tx => ({ ...tx, type: 'received' }))
    ];

    const merchantTx = (merchantPayments || []).map(mp => ({
      ...mp,
      type: 'merchant' // Чтобы на клиенте отобразить, что это оплата мерчанту
    }));

    // Сливаем и сортируем всё вместе (по дате убывания)
    const allTx = [...normalTx, ...merchantTx].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ success: true, transactions: allTx });
  } catch (error) {
    console.error('[Transactions] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'не удалось получить транзакции' });
  }
});

/* ============= ЗАПУСК СЕРВЕРА ============= */
app.listen(port, '0.0.0.0', () => {
  console.log(`[Server] Запущен на http://localhost:${port}`);
});

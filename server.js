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
    <h1>Welcome to GUGACOIN!</h1>
    <p>This is the backend server for GUGACOIN.</p>
  `);
});

// Регистрация пользователя
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Логин и пароль обязательны' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Пароль должен содержать минимум 6 символов' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    // Генерируем 6-значный userId
    const userId = Math.floor(100000 + Math.random() * 900000).toString();

    const { error } = await supabase
      .from('users')
      .insert([{ username, password: hashedPassword, user_id: userId, balance: 0 }]);

    if (error) {
      if (error.message.includes('unique_violation')) {
        return res.status(409).json({ success: false, error: 'Такой логин уже существует' });
      }
      return res.status(500).json({ success: false, error: 'Регистрация не удалась' });
    }

    console.log(`[Регистрация] Новый пользователь: ${username}`);
    res.json({ success: true, userId });
  } catch (error) {
    console.error('[Регистрация] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
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
      return res.status(401).json({ success: false, error: 'Неверные учетные данные' });
    }

    const isPasswordValid = await bcrypt.compare(password, data.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, error: 'Неверные учетные данные' });
    }

    console.log(`[Login] Пользователь вошёл: ${username}`);
    res.json({ success: true, userId: data.user_id });
  } catch (error) {
    console.error('[Login] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Обновление баланса (добыча монет)
app.post('/update', async (req, res) => {
  try {
    const { userId, amount = 0.00001 } = req.body;
    console.log('[Update] Получен запрос:', { userId, amount });
    if (!userId) {
      return res.status(400).json({ success: false, error: 'ID пользователя обязателен' });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Неверная сумма' });
    }

    // Получаем текущий баланс пользователя
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (fetchError || !userData) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }

    // Вычисляем новый баланс с точностью до 5 знаков после запятой
    const newBalance = parseFloat((userData.balance || 0) + amount).toFixed(5);

    // Обновляем баланс пользователя
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('user_id', userId);

    if (updateError) {
      return res.status(500).json({ success: false, error: 'Обновление баланса не удалось' });
    }

    // Если используется таблица mined_coins, получаем общее количество добытых монет
    const { data: minedData, error: minedError } = await supabase
      .from('mined_coins')
      .select('amount');

    let halvingStep = 0;
    if (!minedError && minedData) {
      const totalMined = minedData.reduce((sum, tx) => sum + tx.amount, 0);
      halvingStep = Math.floor(totalMined);
      // Обновляем (или вставляем) запись уровня халвинга
      await supabase
        .from('halving')
        .upsert([{ step: halvingStep }]);
    }

    console.log('[Update] Баланс обновлён успешно:', newBalance, 'Халвинг:', halvingStep);
    res.json({ success: true, balance: newBalance, halvingStep });
  } catch (error) {
    console.error('[Update] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  }
});

// Получение данных пользователя (включая уровень халвинга)
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
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }

    // Получаем данные по халвингу (если есть)
    let halvingStep = 0;
    const { data: halvingData, error: halvingError } = await supabase
      .from('halving')
      .select('step')
      .limit(1);
    if (!halvingError && halvingData && halvingData.length > 0) {
      halvingStep = halvingData[0].step;
    }

    console.log(`[User] Данные получены для пользователя: ${userId}`);
    res.json({ success: true, user: { ...data, halvingStep } });
  } catch (error) {
    console.error('[User] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'Не удалось получить данные пользователя' });
  }
});

// Перевод монет
app.post('/transfer', async (req, res) => {
  try {
    const { fromUserId, toUserId, amount } = req.body;
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Неверная сумма' });
    }
    if (fromUserId === toUserId) {
      return res.status(400).json({ success: false, error: 'Вы не можете перевести монеты самому себе' });
    }

    // Проверяем отправителя
    const { data: fromUser, error: fromError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', fromUserId)
      .single();
    if (fromError || !fromUser) {
      return res.status(404).json({ success: false, error: 'Отправитель не найден' });
    }
    if ((fromUser.balance || 0) < amount) {
      return res.status(400).json({ success: false, error: 'Недостаточно средств' });
    }

    // Проверяем получателя
    const { data: toUser, error: toError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', toUserId)
      .single();
    if (toError || !toUser) {
      return res.status(404).json({ success: false, error: 'Получатель не найден' });
    }

    const newFromBalance = parseFloat((fromUser.balance || 0) - amount).toFixed(5);
    const newToBalance = parseFloat((toUser.balance || 0) + amount).toFixed(5);

    // Обновляем баланс отправителя
    const { error: updateFromError } = await supabase
      .from('users')
      .update({ balance: newFromBalance })
      .eq('user_id', fromUserId);
    if (updateFromError) {
      return res.status(500).json({ success: false, error: 'Ошибка обновления баланса отправителя' });
    }

    // Обновляем баланс получателя
    const { error: updateToError } = await supabase
      .from('users')
      .update({ balance: newToBalance })
      .eq('user_id', toUserId);
    if (updateToError) {
      return res.status(500).json({ success: false, error: 'Ошибка обновления баланса получателя' });
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
      return res.status(500).json({ success: false, error: 'Не удалось записать транзакцию' });
    }

    console.log(`[Transfer] Перевод ${amount} монет от ${fromUserId} к ${toUserId} выполнен успешно`);
    res.json({ success: true, fromBalance: newFromBalance, toBalance: newToBalance });
  } catch (error) {
    console.error('[Transfer] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'Перевод не удался' });
  }
});

// Получение истории транзакций
app.get('/transactions', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'ID пользователя обязателен' });
    }

    // Получаем транзакции, где пользователь является отправителем
    const { data: sentTransactions, error: sentError } = await supabase
      .from('transactions')
      .select('*')
      .eq('from_user_id', userId)
      .order('created_at', { ascending: false });

    // Получаем транзакции, где пользователь является получателем
    const { data: receivedTransactions, error: receivedError } = await supabase
      .from('transactions')
      .select('*')
      .eq('to_user_id', userId)
      .order('created_at', { ascending: false });

    if (sentError || receivedError) {
      return res.status(500).json({ success: false, error: 'Не удалось получить транзакции' });
    }

    // Объединяем транзакции и сортируем по дате (сначала самые свежие)
    const transactions = [
      ...(sentTransactions || []).map(tx => ({ ...tx, type: 'sent' })),
      ...(receivedTransactions || []).map(tx => ({ ...tx, type: 'received' }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ success: true, transactions });
  } catch (error) {
    console.error('[Transactions] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'Не удалось получить транзакции' });
  }
});

// Запуск сервера
app.listen(port, '0.0.0.0', () => {
  console.log(`[Server] Запущен на http://localhost:${port}`);
});

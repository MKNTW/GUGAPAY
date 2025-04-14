
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

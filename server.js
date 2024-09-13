const express = require("express");
const cors = require("cors");
const Datastore = require("nedb");
const path = require("path");
const jwt = require("jsonwebtoken");

const app = express();
const port = 3000;
const SECRET_KEY = "your_secret_key"; // Задайте секретный ключ для подписи JWT

// Подключение к двум базам данных
const usersDb = new Datastore({
  filename: path.join(__dirname, "users.db"),
  autoload: true,
});

const reservesDb = new Datastore({
  filename: path.join(__dirname, "reserves.db"),
  autoload: true,
});

// Middleware для обработки CORS
app.use(
  cors({
    origin: "http://localhost:5173", // Разрешить только для этого источника
  })
);

// Middleware для обработки JSON
app.use(express.json());

// Эндпоинт для создания пользователя
app.post("/users", (req, res) => {
  const { mail, password } = req.body;
  const user = { mail, password };

  usersDb.insert(user, (err, newDoc) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json(newDoc);
  });
});

// Эндпоинт для поиска пользователя по mail и password и получения токена
app.post("/users/login", (req, res) => {
  const { mail, password } = req.body;

  usersDb.findOne({ mail, password }, (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Генерируем JWT токен с сроком действия 3 часа
    const token = jwt.sign({ userId: user._id, mail: user.mail }, SECRET_KEY, {
      expiresIn: "3h", // Токен будет действовать 3 часа
    });

    res.status(200).json({
      token,
      user: {
        id: user._id,
        mail: user.mail,
        role: user.role,
      },
    });
  });
});

// Middleware для проверки токена авторизации
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Token is missing" });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token" });
    }
    req.user = user;
    next();
  });
};

// Эндпоинт для добавления резервации (требуется авторизация)
app.post("/reserve", authenticateToken, (req, res) => {
  const { userId, date, time, service } = req.body;
  const reserve = { userId, date, time, service };

  reservesDb.insert(reserve, (err, newDoc) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json(newDoc);
  });
});

// Эндпоинт для получения всех резерваций (требуется авторизация)
app.get("/reserves", authenticateToken, (req, res) => {
  reservesDb.find({}, (err, docs) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(200).json(docs);
  });
});

// Запускаем сервер
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

const express = require("express");
const cors = require("cors");
const Datastore = require("nedb");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = 3000;
const JWT_SECRET = "your_jwt_secret"; // секрет для токенов
const REFRESH_SECRET = "your_refresh_secret"; // секрет для refresh токенов

// Инициализация базы данных
const usersDb = new Datastore({ filename: "./users.db", autoload: true });
const reservesDb = new Datastore({ filename: "./reserves.db", autoload: true });

app.use(cors());
app.use(express.json()); // Для парсинга JSON тела запросов

// Middleware для проверки токена
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1]; // Ожидается, что токен передается в формате "Bearer token"

  if (!token) {
    return res.status(401).json({ message: "Token is required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    req.user = user; // Добавляем данные пользователя в запрос
    next();
  });
};

// Функция для генерации токенов
const generateTokens = (user) => {
  const token = jwt.sign(
    { _id: user._id, login: user.login, role: user.role },
    JWT_SECRET,
    { expiresIn: "15m" }
  );
  const refreshToken = jwt.sign(
    { _id: user._id, login: user.login, role: user.role },
    REFRESH_SECRET,
    {
      expiresIn: "7d",
    }
  );
  return { token, refreshToken };
};

// Маршрут для регистрации пользователя
app.post("/register", (req, res) => {
  const { login, password, role } = req.body;

  if (!login || !password || !role) {
    return res
      .status(400)
      .json({ message: "Username and password are required" });
  }

  // Проверяем, существует ли уже пользователь
  usersDb.findOne({ login }, (err, existingUser) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Error checking for existing user" });
    }
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const newUser = { login, password, role };

    usersDb.insert(newUser, (err, user) => {
      if (err) {
        return res.status(500).json({ message: "Error registering user" });
      }
      res.status(201).json({ user });
    });
  });
});

// Маршрут для авторизации пользователя (login)
app.post("/login", (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ message: "Логин и пароль обязательны!" });
  }

  usersDb.findOne({ login, password }, (err, user) => {
    if (err) {
      return res.status(500).json({ message: "Error logging in" });
    }
    if (!user) {
      return res.status(401).json({ message: "Неверный логин или пароль" });
    }

    const tokens = generateTokens(user);
    res.status(200).json({ user, tokens });
  });
});

// Маршрут для получения всех пользователей
app.get("/users", authenticateToken, (req, res) => {
  usersDb.find({}, (err, users) => {
    if (err) {
      return res.status(500).json({ message: "Error fetching users" });
    }
    res.status(200).json(users);
  });
});

// Маршрут для обновления токена
app.post("/refresh-token", (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: "Refresh token is required" });
  }

  jwt.verify(refreshToken, REFRESH_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }
    const user = {
      _id: decoded._id,
      login: decoded.login,
      role: decoded.role,

    };
    const tokens = generateTokens(user);
    res.status(200).json(tokens);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

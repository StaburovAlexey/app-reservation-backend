const express = require("express");
const cors = require("cors");
const Datastore = require("nedb");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
const PORT = 3000;
const JWT_SECRET = "your_jwt_secret"; // секрет для токенов
const REFRESH_SECRET = "your_refresh_secret"; // секрет для refresh токенов
const allowedOrigins = ["http://localhost:5173"];
// Инициализация базы данных
const usersDb = new Datastore({ filename: "./users.db", autoload: true });
const reservesDb = new Datastore({ filename: "./reserves.db", autoload: true });

app.use(
  cors({
    origin: "http://localhost:5173", // URL вашего клиента
    credentials: true, // Позволяет отправлять cookies и другие учетные данные
  })
);
app.use(cookieParser()); // Подключаем cookie-parser
app.use(express.json()); // Для парсинга JSON тела запросов

// Функция для проверки и обновления токена
const checkAndRefreshToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  const refreshToken = req.cookies.refreshToken; // Используем refreshToken из cookie

  // Проверяем наличие основного токена
  if (!token) {
    return res.status(401).json({ message: "Token is required." });
  }

  // Проверяем срок действия основного токена
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err && err.name === "TokenExpiredError") {
      console.log("Token expired, attempting to refresh");

      // Если основной токен истек, проверяем наличие refreshToken
      if (!refreshToken) {
        return res
          .status(401)
          .json({ message: "Refresh token is required. Please log in again." });
      }

      // Проверяем срок действия refreshToken
      jwt.verify(refreshToken, REFRESH_SECRET, (err, decoded) => {
        if (err) {
          if (err.name === "TokenExpiredError") {
            return res
              .status(403)
              .json({ message: "Refresh token expired. Please log in again." });
          }
          return res.status(403).json({ message: "Invalid refresh token." });
        }

        // Создаем новые токены
        const userData = {
          _id: decoded._id,
          login: decoded.login,
          role: decoded.role,
        };
        const tokens = generateTokens(userData);

        // Устанавливаем новый refreshToken в cookie
        res.cookie("refreshToken", tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
          // maxAge: 10 * 1000, // Время жизни cookie (10 секунд)
          sameSite: "Lax", // Для кросс-доменных запросов
        });

        // Передаем новый токен для дальнейшего использования
        req.newToken = tokens.token;
        req.user = userData; // Данные пользователя
        next();
      });
    } else if (err) {
      return res.status(403).json({ message: "Invalid token." });
    } else {
      // Если основной токен действителен, продолжаем
      req.user = user; // Данные пользователя
      next();
    }
  });
};

// Функция для генерации новых токенов
const generateTokens = (user) => {
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: "1h" }); // Основной токен (30 секунд)
  const refreshToken = jwt.sign(user, REFRESH_SECRET, { expiresIn: "7d" }); // Refresh токен (7 дней)
  return { token, refreshToken };
};

// Маршрут для регистрации пользователя
app.post("/register", checkAndRefreshToken, (req, res) => {
  const user = req.body;
  const { login, password, role } = user;

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

    const newUser = user;

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

    // Устанавливаем Refresh Token в HTTP-only cookie
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: true, // Установите true, если вы используете HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000, // Время жизни cookie (7 дней)
      // maxAge: 10 * 1000, // Время жизни cookie (10 секунд)
      sameSite: "Lax",
    });

    res.status(200).json({ user, token: tokens.token });
  });
});
// выход из системы
app.post("/logout", (req, res) => {
  res.clearCookie("refreshToken");
  res.status(204).send(); // 204 No Content
});

// Маршрут для получения всех пользователей
app.get("/users", checkAndRefreshToken, (req, res) => {
  usersDb.find({}, (err, users) => {
    if (err) {
      return res.status(500).json({ message: "Error fetching users" });
    }
    res.status(200).json(users);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

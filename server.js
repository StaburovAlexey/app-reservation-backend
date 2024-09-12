const express = require("express");
const cors = require("cors");
const Datastore = require("nedb");
const path = require("path");

const app = express();
const port = 3000;

// Создаем подключение к базе данных
const db = new Datastore({
  filename: path.join(__dirname, "database.db"),
  autoload: true,
});

// Middleware для обработки CORS
app.use(cors());

// Middleware для обработки JSON
app.use(express.json());

// Эндпоинт для создания пользователя
app.post("/users", (req, res) => {
  const { mail, password } = req.body;
  const user = { mail, password };

  db.insert(user, (err, newDoc) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json(newDoc);
  });
});

// Эндпоинт для получения всех пользователей
app.get("/users", (req, res) => {
  db.find({}, (err, docs) => {
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

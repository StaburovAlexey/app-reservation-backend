// backup.js
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");

// Функция для бэкапа базы данных
const backupDatabase = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-"); // Для уникальных имен файлов
  const usersBackup = `./backups/users-backup-${timestamp}.db`;
  const reservesBackup = `./backups/reserves-backup-${timestamp}.db`;

  // Создание каталога для бэкапов, если он не существует
  if (!fs.existsSync("./backups")) {
    fs.mkdirSync("./backups");
  }

  // Копирование users.db
  fs.copyFile("./users.db", usersBackup, (err) => {
    if (err) {
      console.error("Error backing up users.db:", err);
    } else {
      console.log("Backup for users.db created:", usersBackup);
    }
  });

  // Копирование reserves.db
  fs.copyFile("./reserves.db", reservesBackup, (err) => {
    if (err) {
      console.error("Error backing up reserves.db:", err);
    } else {
      console.log("Backup for reserves.db created:", reservesBackup);
    }
  });

  // Очистка старых бэкапов
  cleanupOldBackups("./backups", "users-backup", 3); // Оставляем последние 4 бэкапа для users
  cleanupOldBackups("./backups", "reserves-backup", 3); // Оставляем последние 4 бэкапа для reserves
};

// Функция для очистки старых бэкапов
const cleanupOldBackups = (backupDir, backupPrefix, keepCount) => {
  fs.readdir(backupDir, (err, files) => {
    if (err) {
      console.error("Error reading backup directory:", err);
      return;
    }

    // Фильтруем только файлы, которые связаны с нужным бэкапом (users или reserves)
    const backupFiles = files.filter((file) => file.startsWith(backupPrefix));

    // Сортируем файлы по дате создания (по имени файла, т.к. оно содержит метку времени)
    backupFiles.sort((a, b) => {
      const timeA = fs.statSync(path.join(backupDir, a)).mtime.getTime();
      const timeB = fs.statSync(path.join(backupDir, b)).mtime.getTime();
      return timeA - timeB; // Самые старые первыми
    });

    // Удаляем только самый старый файл, если бэкапов больше `keepCount`
    if (backupFiles.length > keepCount) {
      const oldestFile = backupFiles[0]; // Самый старый файл — первый в отсортированном списке
      const filePath = path.join(backupDir, oldestFile);

      fs.unlink(filePath, (err) => {
        if (err) {
          console.error("Error deleting file:", filePath, err);
        } else {
          console.log("Deleted old backup:", filePath);
        }
      });
    }
  });
};

// Функция для планирования задач
const scheduleBackup = () => {
  // Запускаем задачу каждый день в 4:00 утра
  cron.schedule("0 4 * * *", () => {
    console.log("Running daily database backup task at 4:00 AM...");
    backupDatabase();
  });
};

// Экспорт функций
module.exports = {
  scheduleBackup,
};

const mysql = require("mysql2");
const dotenv = require("dotenv");
const path = require("path");

// Fix: Tell dotenv where to find .env file
dotenv.config({ path: path.join(__dirname, "../.env") });

// Rest of your code stays the same...
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
  } else {
    console.log("✅ Database connected successfully!");
    connection.release();
  }
});

// Export promise-based pool
module.exports = pool.promise();

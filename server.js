const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const db = require("./config/database");

// Load env variables
dotenv.config();

// Import routes
const authRoutes = require("./routes/auth");
const orderRoutes = require("./routes/orders");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "Rider Delivery API is running!",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

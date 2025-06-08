const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/database");

// Login route
router.post("/login", async (req, res) => {
  console.log("=== LOGIN ATTEMPT ===");
  console.log("Request body:", req.body);

  try {
    const { username, password } = req.body;
    console.log("Username:", username);
    console.log("Password received:", password);

    // Get user from database
    const [users] = await db.query("SELECT * FROM users WHERE username = ?", [username]);
    console.log("Query result - users found:", users.length);

    if (users.length > 0) {
      console.log("User found:", users[0].username);
      console.log("Stored hash:", users[0].password);
    }

    if (users.length === 0) {
      console.log("No user found with username:", username);
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const user = users[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    console.log("Password comparison result:", validPassword);

    if (!validPassword) {
      console.log("Password does not match");
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    console.log("Login successful for user:", user.username);

    // Create token
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const db = require("../config/database");
const authMiddleware = require("../middleware/auth");
const axios = require("axios");

// All routes here need login
router.use(authMiddleware);

router.get("/public/tomorrow", async (req, res) => {
  try {
    const [orders] = await db.query("SELECT * FROM orders WHERE delivery_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY) AND status = 'confirmed'");
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET all orders
router.get("/", async (req, res) => {
  try {
    const [orders] = await db.query("SELECT * FROM orders ORDER BY delivery_date DESC");
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET today's orders
router.get("/today", async (req, res) => {
  try {
    const [orders] = await db.query("SELECT * FROM orders WHERE delivery_date = CURDATE() ORDER BY delivery_time");
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// CREATE new order
router.post("/", async (req, res) => {
  try {
    const { recipient_name, phone, address, cake_description, delivery_fee, delivery_date, delivery_time, collection_time, notes } = req.body;

    const [result] = await db.query(
      `INSERT INTO orders (
          recipient_name, phone, address, cake_description, 
          delivery_fee, delivery_date, delivery_time, 
          collection_time, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [recipient_name, phone, address, cake_description, delivery_fee, delivery_date, delivery_time, collection_time, notes || null]
    );

    const orderId = result.insertId;

    // NEW: Trigger N8N webhook
    if (process.env.N8N_WEBHOOK_URL) {
      try {
        await axios.post(process.env.N8N_WEBHOOK_URL, {
          event: "order_created",
          orderId: orderId,
          recipient_name,
          phone,
          delivery_date,
          delivery_time,
          cake_description,
        });
      } catch (n8nError) {
        console.error("N8N webhook failed:", n8nError.message);
        // Don't fail the order if N8N is down
      }
    }

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: { id: orderId },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single order by ID
router.get("/:id", async (req, res) => {
  try {
    const [orders] = await db.query("SELECT * FROM orders WHERE id = ?", [req.params.id]);

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.json({ success: true, data: orders[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// UPDATE order
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove id from updates if it exists
    delete updates.id;

    // Build dynamic UPDATE query
    const fields = Object.keys(updates);
    const values = Object.values(updates);

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    const setClause = fields.map((field) => `${field} = ?`).join(", ");

    await db.query(`UPDATE orders SET ${setClause} WHERE id = ?`, [...values, id]);

    res.json({
      success: true,
      message: "Order updated successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// UPDATE order status only
// UPDATE order status only (with N8N trigger)
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["pending", "confirmed", "delivered", "cancelled"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be: " + validStatuses.join(", "),
      });
    }

    // NEW: Get order details first (for N8N)
    const [orders] = await db.query("SELECT * FROM orders WHERE id = ?", [id]);
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    await db.query("UPDATE orders SET status = ? WHERE id = ?", [status, id]);

    // NEW: Trigger N8N webhook when status changes
    if (process.env.N8N_WEBHOOK_URL) {
      try {
        await axios.post(process.env.N8N_WEBHOOK_URL, {
          event: "status_updated",
          orderId: id,
          status: status,
          order: orders[0], // Send full order details
        });
      } catch (n8nError) {
        console.error("N8N webhook failed:", n8nError.message);
      }
    }

    res.json({
      success: true,
      message: `Order status updated to ${status}`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE order
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM orders WHERE id = ?", [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET monthly income
router.get("/income/monthly", async (req, res) => {
  try {
    const { year, month } = req.query;

    let query = `
        SELECT 
          YEAR(delivery_date) as year,
          MONTH(delivery_date) as month,
          COUNT(*) as total_deliveries,
          SUM(delivery_fee) as total_income
        FROM orders 
        WHERE status = 'delivered'
      `;

    const params = [];

    if (year && month) {
      query += " AND YEAR(delivery_date) = ? AND MONTH(delivery_date) = ?";
      params.push(year, month);
    } else if (year) {
      query += " AND YEAR(delivery_date) = ?";
      params.push(year);
    }

    query += " GROUP BY YEAR(delivery_date), MONTH(delivery_date) ORDER BY year DESC, month DESC";

    const [income] = await db.query(query, params);

    res.json({ success: true, data: income });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

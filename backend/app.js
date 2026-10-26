
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");

const app = express();

app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "laundry_db",
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true
});

const STATUSES = [
  "Received",
  "Washing",
  "Ironing",
  "Ready",
  "Delivered",
  "Cancelled"
];

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "Database connection failed"
    });
  }
});

app.get("/api/services", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT service_id, name, description, price, unit
       FROM services
       WHERE active = TRUE
       ORDER BY service_id`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

app.get("/api/orders", async (req, res, next) => {
  try {
    const [orders] = await pool.query(
      `SELECT o.order_id, c.name AS customer_name,
              c.phone, o.pickup_date, o.notes, o.status,
              o.total_amount, o.payment_status, o.created_at
       FROM orders o
       JOIN customers c ON c.customer_id = o.customer_id
       ORDER BY o.created_at DESC`
    );

    if (orders.length === 0) return res.json([]);

    const ids = orders.map(o => o.order_id);
    const placeholders = ids.map(() => "?").join(",");

    const [items] = await pool.query(
      `SELECT oi.order_id, s.name AS service_name,
              oi.quantity, s.unit, oi.unit_price, oi.subtotal
       FROM order_items oi
       JOIN services s ON s.service_id = oi.service_id
       WHERE oi.order_id IN (${placeholders})
       ORDER BY oi.item_id`,
      ids
    );

    const grouped = {};
    for (const item of items) {
      if (!grouped[item.order_id]) grouped[item.order_id] = [];
      grouped[item.order_id].push(item);
    }

    res.json(orders.map(o => ({
      ...o,
      items: grouped[o.order_id] || []
    })));
  } catch (err) {
    next(err);
  }
});

app.post("/api/orders", async (req, res, next) => {
  const { name, phone, pickupDate, notes, items } = req.body;

  if (
    typeof name !== "string" || !name.trim() ||
    typeof phone !== "string" || !phone.trim() ||
    !Array.isArray(items) || items.length === 0
  ) {
    return res.status(400).json({
      error: "Name, phone and at least one service are required"
    });
  }

  if (name.trim().length > 100 || phone.trim().length > 20) {
    return res.status(400).json({ error: "Input is too long" });
  }

  if (pickupDate &&
      !/^\d{4}-\d{2}-\d{2}$/.test(pickupDate)) {
    return res.status(400).json({
      error: "Pickup date must use YYYY-MM-DD"
    });
  }

  if (notes && (typeof notes !== "string" || notes.length > 1000)) {
    return res.status(400).json({ error: "Invalid notes" });
  }

  const normalized = new Map();

  for (const item of items) {
    const id = Number(item.serviceId);
    const qty = Number(item.quantity);

    if (!Number.isInteger(id) || id < 1 ||
        !Number.isInteger(qty) || qty < 0 || qty > 1000) {
      return res.status(400).json({
        error: "Invalid service or quantity"
      });
    }

    if (qty > 0) normalized.set(id, (normalized.get(id) || 0) + qty);
  }

  if (normalized.size === 0) {
    return res.status(400).json({
      error: "Select at least one service"
    });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const serviceIds = [...normalized.keys()];
    const marks = serviceIds.map(() => "?").join(",");

    const [services] = await conn.query(
      `SELECT service_id, price FROM services
       WHERE active = TRUE AND service_id IN (${marks})`,
      serviceIds
    );

    if (services.length !== serviceIds.length) {
      await conn.rollback();
      return res.status(400).json({
        error: "One or more selected services are unavailable"
      });
    }

    const priceMap = new Map(
      services.map(s => [s.service_id, Number(s.price)])
    );

    let total = 0;
    for (const [id, qty] of normalized) {
      total += Math.round(priceMap.get(id) * 100) * qty;
    }
    total = total / 100;

    const [customerResult] = await conn.query(
      `INSERT INTO customers (name, phone)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         customer_id = LAST_INSERT_ID(customer_id)`,
      [name.trim(), phone.trim()]
    );

    const customerId = customerResult.insertId;

    const [orderResult] = await conn.query(
      `INSERT INTO orders
       (customer_id, pickup_date, notes, total_amount)
       VALUES (?, ?, ?, ?)`,
      [customerId, pickupDate || null, notes?.trim() || null, total]
    );

    const orderId = orderResult.insertId;

    for (const [serviceId, quantity] of normalized) {
      const unitPrice = priceMap.get(serviceId);
      const subtotal =
        Math.round(unitPrice * 100) * quantity / 100;

      await conn.query(
        `INSERT INTO order_items
         (order_id, service_id, quantity, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, serviceId, quantity, unitPrice, subtotal]
      );
    }

    await conn.query(
      `INSERT INTO order_status_history (order_id, status)
       VALUES (?, 'Received')`,
      [orderId]
    );

    await conn.commit();

    res.status(201).json({
      message: "Order placed successfully",
      orderId,
      totalAmount: total
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

app.patch("/api/orders/:id/status", async (req, res, next) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  if (!Number.isInteger(id) || id < 1 ||
      !STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid order or status" });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      "SELECT status FROM orders WHERE order_id = ? FOR UPDATE",
      [id]
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: "Order not found" });
    }

    const current = rows[0].status;

    if (current === "Cancelled" || current === "Delivered") {
      await conn.rollback();
      return res.status(400).json({
        error: "This order is already completed or cancelled"
      });
    }

    if (status === "Received" && current !== "Received") {
      await conn.rollback();
      return res.status(400).json({
        error: "Orders cannot move backwards to Received"
      });
    }

    if (status === "Cancelled" && current === "Ready") {
      await conn.rollback();
      return res.status(400).json({
        error: "A ready order cannot be cancelled in this demo"
      });
    }

    const allowedNext = {
      Received: ["Washing", "Cancelled"],
      Washing: ["Ironing", "Cancelled"],
      Ironing: ["Ready", "Cancelled"],
      Ready: ["Delivered"]
    };

    if (status !== current &&
        !(allowedNext[current] || []).includes(status)) {
      await conn.rollback();
      return res.status(400).json({
        error: `Cannot change status from ${current} to ${status}`
      });
    }

    if (status !== current) {
      await conn.query(
        "UPDATE orders SET status = ? WHERE order_id = ?",
        [status, id]
      );

      await conn.query(
        `INSERT INTO order_status_history (order_id, status)
         VALUES (?, ?)`,
        [id, status]
      );
    }

    await conn.commit();
    res.json({ message: "Order status updated", status });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

app.patch("/api/orders/:id/payment", async (req, res, next) => {
  const id = Number(req.params.id);
  const method = req.body.method || "Cash";

  if (!Number.isInteger(id) || id < 1 ||
      !["Cash", "UPI", "Card"].includes(method)) {
    return res.status(400).json({ error: "Invalid payment details" });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT total_amount, payment_status
       FROM orders WHERE order_id = ? FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: "Order not found" });
    }

    if (rows[0].payment_status === "Paid") {
      await conn.rollback();
      return res.status(400).json({ error: "Order is already paid" });
    }

    await conn.query(
      "UPDATE orders SET payment_status = 'Paid' WHERE order_id = ?",
      [id]
    );

    await conn.query(
      `INSERT INTO payments (order_id, amount, method, status)
       VALUES (?, ?, ?, 'Paid')`,
      [id, rows[0].total_amount, method]
    );

    await conn.commit();
    res.json({ message: "Payment recorded", paymentStatus: "Paid" });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

app.get("/api/admin/stats", async (req, res, next) => {
  try {
    const [[summary]] = await pool.query(`
      SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(status NOT IN ('Delivered','Cancelled')), 0)
          AS active_orders,
        COALESCE(SUM(status = 'Ready'), 0) AS ready_orders,
        COALESCE(SUM(payment_status = 'Paid'), 0) AS paid_orders,
        COALESCE(SUM(
          CASE WHEN payment_status = 'Paid'
               THEN total_amount ELSE 0 END
        ), 0) AS collected_revenue
      FROM orders
    `);

    const [popular] = await pool.query(`
      SELECT s.name, COALESCE(SUM(oi.quantity), 0) AS quantity
      FROM services s
      LEFT JOIN order_items oi ON oi.service_id = s.service_id
      LEFT JOIN orders o ON o.order_id = oi.order_id
        AND o.status <> 'Cancelled'
      GROUP BY s.service_id, s.name
      ORDER BY quantity DESC
      LIMIT 5
    `);

    res.json({ ...summary, popular_services: popular });
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: "Server error. Check the backend terminal."
  });
});

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await pool.query("SELECT 1");
    app.listen(PORT, () => {
      console.log(`Laundry API running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Could not connect to MySQL:", err.message);
    process.exit(1);
  }
}

start();

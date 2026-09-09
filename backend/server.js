// server.js — Main backend entry point
// SIH Project: AI-Powered Voice Clone Detection — Member 6 (Backend + DB + Integration)

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first'); // fixes MongoDB SRV lookup (ECONNREFUSED) on some networks

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const RiskAlert = require('./models/RiskAlert'); // our schema from Step 1

const app = express();

// ---- WebSocket setup ----
// Express normally runs on a plain HTTP server. Socket.io needs to attach
// to that same server, so we create it explicitly instead of using app.listen() directly.
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" } // allow dashboard (any origin) to connect — fine for hackathon
});

io.on('connection', (socket) => {
  console.log('🔌 Dashboard connected via WebSocket:', socket.id);

  socket.on('disconnect', () => {
    console.log('🔌 Dashboard disconnected:', socket.id);
  });
});

// ---- Middleware ----
app.use(cors());           // allows frontend (React) to call this backend
app.use(express.json());   // allows server to read JSON in request bodies

// ---- MongoDB Connection ----
// Replace the string in .env file with your own MongoDB Atlas connection string
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/voice_clone_detection";

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ---- Test Route ----
app.get('/', (req, res) => {
  res.json({ message: "Voice Clone Detection Backend is running!" });
});

// ---- POST route: insert a new risk alert (for testing with Postman,
// and later this is where Member 5's real output will be sent) ----
app.post('/api/alerts', async (req, res) => {
  try {
    const newAlert = new RiskAlert(req.body); // req.body = the JSON you send
    const savedAlert = await newAlert.save();  // saves it into MongoDB

    // ---- Push this new alert to every connected dashboard instantly ----
    io.emit('new_alert', savedAlert);

    res.status(201).json(savedAlert);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---- GET route: fetch all risk alerts (this is what the frontend will call) ----
app.get('/api/alerts', async (req, res) => {
  try {
    const alerts = await RiskAlert.find().sort({ timestamp: -1 }); // newest first
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- GET route: fetch a single call's detail by call_id ----
app.get('/api/call/:id', async (req, res) => {
  try {
    const alert = await RiskAlert.findOne({ call_id: req.params.id });
    if (!alert) return res.status(404).json({ error: "Call not found" });
    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Health check route (useful for debugging) ----
app.get('/health', (req, res) => {
  res.json({
    status: "OK",
    mongoConnected: mongoose.connection.readyState === 1
  });
});

// ---- Start Server ----
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket ready for real-time connections`);
});
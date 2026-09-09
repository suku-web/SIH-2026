// server.js — Main backend entry point
// SIH Project: AI-Powered Voice Clone Detection — Member 6 (Backend + DB + Integration)

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first'); // fixes MongoDB SRV lookup (ECONNREFUSED) on some networks
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');   // for handling audio file uploads
const axios = require('axios');     // for calling teammates' Python APIs
const FormData = require('form-data'); // for sending files to those APIs
const fs = require('fs');
require('dotenv').config();

const RiskAlert = require('./models/RiskAlert'); // our schema from Step 1

const upload = multer({ dest: 'uploads/' }); // temp storage for incoming audio files

// ---- URLs of teammates' microservices (change ports if theirs differ) ----
const SPEAKER_API = process.env.SPEAKER_API || "http://localhost:8004"; // Fizza
const CLONE_API = process.env.CLONE_API || "http://localhost:8000";     // Sakshi Mehta
const RISK_API = process.env.RISK_API || "http://localhost:8005";       // Siddhee (once she wraps it in FastAPI)

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

// ==========================================================================
// MAIN ORCHESTRATION ROUTE — this is the heart of the integration.
// Frontend/Palak's voice capture sends an audio file here. This route
// calls each teammate's API in sequence, combines results, saves to
// MongoDB, and pushes to the dashboard in real time.
// ==========================================================================
app.post('/api/process-call', upload.single('audio'), async (req, res) => {
  const audioPath = req.file?.path;
  const claimedIdentity = req.body.claimed_identity || "unknown";

  if (!audioPath) {
    return res.status(400).json({ error: "No audio file uploaded (field name must be 'audio')" });
  }

  try {
    // ---- Step 1: Call Fizza's speaker + conversation analysis API ----
    const speakerForm = new FormData();
    speakerForm.append('file', fs.createReadStream(audioPath));
    speakerForm.append('claimed_identity', claimedIdentity);

    const analysisRes = await axios.post(`${SPEAKER_API}/analyze`, speakerForm, {
      headers: speakerForm.getHeaders()
    });
    const analysis = analysisRes.data;

    // ---- Step 2: Call Sakshi Mehta's voice clone detection API ----
    const cloneForm = new FormData();
    cloneForm.append('file', fs.createReadStream(audioPath));

    const cloneRes = await axios.post(`${CLONE_API}/predict`, cloneForm, {
      headers: cloneForm.getHeaders()
    });
    const cloneDetection = cloneRes.data;

    // ---- Step 3: Send combined analysis to Siddhee's risk engine ----
    // NOTE: this assumes Siddhee wraps her risk engine as a FastAPI service
    // with a POST /calculate-risk endpoint that accepts { analysis, clone_detection }
    // and returns { risk: {...}, audit: {...} }. Update the path/shape once
    // she confirms her actual endpoint.
    const riskRes = await axios.post(`${RISK_API}/calculate-risk`, {
      analysis,
      clone_detection: cloneDetection
    });
    const { risk, audit } = riskRes.data;

    // ---- Step 4: Build final document and save to MongoDB ----
    const alertData = {
      call_id: audit?.recordId || audit?.record_id || `call-${Date.now()}`,
      claimed_identity: claimedIdentity,
      risk_score: risk?.riskScore ?? risk?.risk_score,
      risk_level: (risk?.riskLevel || risk?.risk_level || '').toUpperCase(),
      decision: (risk?.decision || '').toUpperCase(),
      recommended_action: risk?.recommendedAction || risk?.recommended_action,
      blockchain_tx_hash: audit?.hash,
      timestamp: audit?.timestamp || new Date(),
      analysis: {
        speaker_match_score: analysis?.speaker_match_score,
        identity_verified: analysis?.identity_verified,
        transcript: analysis?.transcript,
        conversation_risk_score: analysis?.conversation_risk_score,
        risk_flags: analysis?.risk_flags || [],
        matched_phrases: analysis?.matched_phrases || {}
      },
      clone_detection: {
        result: cloneDetection?.result,
        real_probability: cloneDetection?.real_probability,
        fake_probability: cloneDetection?.fake_probability,
        validation_accuracy: cloneDetection?.validation_accuracy
      },
      audit: {
        record_id: audit?.recordId || audit?.record_id,
        hash: audit?.hash,
        integrity_verified: true
      }
    };

    const newAlert = new RiskAlert(alertData);
    const savedAlert = await newAlert.save();

    // ---- Step 5: Push to dashboard in real time ----
    io.emit('new_alert', savedAlert);

    // ---- Cleanup temp audio file ----
    fs.unlink(audioPath, () => {});

    res.status(201).json(savedAlert);

  } catch (err) {
    console.error("❌ Pipeline error:", err.message);
    // clean up the temp file even on failure
    if (audioPath) fs.unlink(audioPath, () => {});
    res.status(500).json({
      error: "Pipeline processing failed",
      details: err.message,
      hint: "Check that Fizza's (8004), Sakshi Mehta's (8000), and Siddhee's risk engine APIs are all running"
    });
  }
});

// ---- POST route: receives the pipeline's raw output (analysis + risk + audit)
// and transforms it into our schema shape before saving.
// Useful for testing with Postman/manual payloads, or if a teammate wants
// to POST their combined JSON directly without going through the audio pipeline. ----
app.post('/api/alerts', async (req, res) => {
  try {
    const { analysis, risk, audit, clone_detection } = req.body;

    // Build the flattened document our schema expects.
    // This "adapter" step means teammates don't need to change their
    // output format — we do the translation here in one place.
    const alertData = {
      call_id: audit?.recordId || audit?.record_id || `call-${Date.now()}`,
      claimed_identity: analysis?.claimed_identity || analysis?.claimedIdentity,
      risk_score: risk?.riskScore ?? risk?.risk_score,
      risk_level: (risk?.riskLevel || risk?.risk_level || '').toUpperCase(),
      decision: (risk?.decision || '').toUpperCase(),
      recommended_action: risk?.recommendedAction || risk?.recommended_action,
      blockchain_tx_hash: audit?.hash,
      timestamp: audit?.timestamp || new Date(),

      analysis: {
        speaker_match_score: analysis?.speaker_match_score,
        identity_verified: analysis?.identity_verified,
        transcript: analysis?.transcript,
        conversation_risk_score: analysis?.conversation_risk_score,
        risk_flags: analysis?.risk_flags || [],
        matched_phrases: analysis?.matched_phrases || {}
      },

      clone_detection: clone_detection ? {
        result: clone_detection.result,
        real_probability: clone_detection.real_probability,
        fake_probability: clone_detection.fake_probability,
        validation_accuracy: clone_detection.validation_accuracy
      } : undefined,

      audit: {
        record_id: audit?.recordId || audit?.record_id,
        hash: audit?.hash,
        integrity_verified: true // set by whoever calls verify_audit_record()
      }
    };

    const newAlert = new RiskAlert(alertData);
    const savedAlert = await newAlert.save();

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
  console.log(` Server running on http://localhost:${PORT}`);
  console.log(` WebSocket ready for real-time connections`);
});
// models/RiskAlert.js
// Defines the shape of data stored in the "risk_alerts" collection

const mongoose = require('mongoose');

const riskAlertSchema = new mongoose.Schema({
  call_id: {
    type: String,
    required: true
  },
  risk_score: {
    type: Number,
    required: true
  },
  risk_level: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'], // only these 4 values allowed
    required: true
  },
  decision: {
    type: String,
    enum: ['Genuine', 'Suspicious', 'Fraudulent'],
    required: true
  },
  reasons: {
    type: [String],  // array of strings, e.g. ["voice clone probability high", "speaker mismatch"]
    default: []
  },
  recommended_action: {
    type: String,
    default: 'none'
  },
  blockchain_tx_hash: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now  // auto-fills current time if not provided
  }
});

// "RiskAlert" model maps to the "riskalerts" collection in MongoDB automatically
module.exports = mongoose.model('RiskAlert', riskAlertSchema);
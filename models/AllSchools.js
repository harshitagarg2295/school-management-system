const mongoose = require("mongoose");

const schoolSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  code: {
    type: String,
    required: true,
    unique: true
  },

  adminUsername: {
    type: String,
    required: true
  },

  adminPassword: {
    type: String,
    required: true
  },

 planType: { 
    type: String, 
    default: "quarterly" // default plan
  },

  subscriptionStart: {
    type: Date,
    default: Date.now
  },

  subscriptionEnd: {
    type: Date
  },

  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
}

}, { timestamps: true });

module.exports = mongoose.model("AllSchools", schoolSchema);
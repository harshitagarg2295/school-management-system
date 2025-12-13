
const mongoose = require("mongoose");

const fundSchema = new mongoose.Schema({
  key: { type: String, default: "fund" },
  value: { type: Number, required: true },
  date: { type: Date, default: Date.now }  // ✅ new field
});

module.exports = mongoose.model("Fund", fundSchema);

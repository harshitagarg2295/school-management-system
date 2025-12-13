const mongoose = require("mongoose");

const holidaySchema = new mongoose.Schema({
  role: { 
    type: String, 
    enum: ["teacher", "student", "staff"], // किसके लिए holiday है
    required: true 
  },
  date: { type: Date, required: true },
  reason: { type: String, default: "" }
});

module.exports = mongoose.model("Holiday", holidaySchema);

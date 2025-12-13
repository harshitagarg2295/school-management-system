const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  date: { type: Date, required: true },
  time: { type: String, required: true }, // store as "10:00 AM"
});

module.exports = mongoose.model("Event", eventSchema);

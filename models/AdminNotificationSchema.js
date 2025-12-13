const mongoose = require("mongoose");

const AdminNotificationSchema = new mongoose.Schema({
  notifications: [
    {
      message: String,
      read: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now },
    }
  ]
});

module.exports = mongoose.model("AdminNotification", AdminNotificationSchema);

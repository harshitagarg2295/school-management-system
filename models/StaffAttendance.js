const mongoose = require('mongoose')

const attendanceSchema = new mongoose.Schema({
    schoolCode: {
        type: String,
        required: true
    },
    staffId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Staff",
        required: true,
    },
    date: {
        // type: String, // Format: YYYY-MM-DD
        type: Date,
        required: true,
    },
    status: {
        type: String, // "P" or "A"
        enum: ["P", "A", "L"],
        required: true,
    },
    source: {
        type: String,
        enum: ["manual", "biometric"],
        default: "manual"
    }
})

module.exports = mongoose.model("StaffAttendance", attendanceSchema);
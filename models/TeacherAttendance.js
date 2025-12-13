const mongoose = require('mongoose')

const attendanceSchema = new mongoose.Schema({
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Teacher",
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

module.exports = mongoose.model("TeacherAttendance", attendanceSchema);
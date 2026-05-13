const mongoose = require('mongoose')

const announcement = new mongoose.Schema({
    schoolCode: {
        type: String,
        required: true
    },
    by: { type: String, required: true },
    teacherName: { type: String },
    title: { type: String, required: true },
    description: { type: String, required: true },
    date: { type: Date, required: true },
    class: { type: String, default: "All" },
    target: { type: String, default: "student" }  // "student" ya "teacher"

})

module.exports = mongoose.model("Announcement", announcement)

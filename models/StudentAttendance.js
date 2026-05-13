const mongoose = require('mongoose')

const studentAttendanceSchema = new mongoose.Schema({
  schoolCode: {
    type: String,
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ["P", "A"],
    required: true
  }
});

module.exports = mongoose.model("StudentAttendance", studentAttendanceSchema)
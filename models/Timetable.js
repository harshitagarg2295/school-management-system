const mongoose = require("mongoose");
const timetableSchema = new mongoose.Schema({
    class: String,
    type: String,         // "monthly" or "exams"
    period: String,       // Month name or Exam type
    subjects: [{date: Date, name: String}],
});
module.exports = mongoose.model("Timetable", timetableSchema);

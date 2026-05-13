const mongoose = require("mongoose");
const syllabusSchema = new mongoose.Schema({
    schoolCode: {
        type: String,
        required: true
    },
    class: String,
    type: String,         // "monthly" or "exams"
    period: String,       // Month name or Exam type
    subjects: [{ name: String, content: String }],
});
module.exports = mongoose.model("Syllabus", syllabusSchema);

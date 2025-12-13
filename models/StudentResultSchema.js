
const mongoose = require("mongoose");

const studentResultSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentSchema", required: true },
  class: { type: String, required: true },
  examType: { type: String, required: true },   // Monthly Test / Exam
  examName: { type: String, required: true },   // Month name / Exam name
  year: { type: Number, required: true },
  outOf: { type: Number, required: true },
  marks: { type: Map, of: Number, default: {} },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "TeacherSchema" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

studentResultSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("StudentResultSchema", studentResultSchema);

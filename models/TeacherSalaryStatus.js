
const mongoose = require("mongoose");

const salaryStatusSchema = new mongoose.Schema({

  schoolCode: {
    type: String,
    required: true
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "TeacherSchema",
    required: true,
  },
  month: { type: Number, required: true }, // 1-12
  year: { type: Number, required: true },
  status: {
    type: String,
    enum: ["paid", "pending"],
    default: "pending",
  },

  // extra fields
  totalSalary: { type: Number, required: true },   // Fixed salary of teacher
  payableSalary: { type: Number, required: true }, // after deductions
  absentDays: { type: Number, default: 0 },
  presentDays: { type: Number, default: 0 },
  lateCount: { type: Number, default: 0 },
  totalAbsent: { type: Number, default: 0 },
  deduction: { type: Number, default: 0 }, // salary cut due to absence/late
  paidOn: { type: Date } // when admin marks salary as paid
});

salaryStatusSchema.index({ teacherId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("TeacherSalaryStatus", salaryStatusSchema);


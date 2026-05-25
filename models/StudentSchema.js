const mongoose = require('mongoose')

const studentSchema = new mongoose.Schema({
  schoolCode: { type: String, required: true },
  name: String,
  id: String, // Admission No / Student ID
  class: String,
  section: String,
  rollNo: String,
  house: String,
  bloodGroup: String,
  gender: String,
  DOB: Date,
  admissionDate: Date,
  fatherName: String,
  motherName: String,
  initialClass: String,
  previousSchool: String,
  fees: Number,
  phone: Number,
  address: String,
  photo: String,
  username: { type: String, required: true },
  password: { type: String, required: true },
  feeStatus: [
    {
      feeType: String,
      installment: String,
      month: String,
      amount: Number,
      status: String,
      mode: String,
      paymentDate: Date
    }
  ],
}, {
  toObject: { id: false, virtuals: true, getters: true },
  toJSON: { virtuals: true, id: false }
});

studentSchema.index(
  {
    username: 1,
    schoolCode: 1
  },
  {
    unique: true
  }
);

module.exports = mongoose.model("StudentSchema", studentSchema);
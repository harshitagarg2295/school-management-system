const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  schoolCode: { type: String, required: true },

  // ── BASIC INFO (renamed) ──────────────────────────────────────
  studentName: { type: String, default: "" },      // was: name
  admissionNo: { type: String, default: "" },      // was: id (Admission Number)

  // ── ACADEMIC ─────────────────────────────────────────────────
  class: String,
  section: String,
  rollNo: String,
  house: String,
  bloodGroup: String,
  gender: String,
  DOB: Date,
  admissionDate: Date,
  initialClass: String,
  previousSchool: String,

  // ── FEES ─────────────────────────────────────────────────────
  fees: Number,

  // ── CONTACT ──────────────────────────────────────────────────
  phone: Number,
  address: String,

  // ── PHOTO & LOGIN ─────────────────────────────────────────────
  photo: String,
  username: { type: String, required: true },
  password: { type: String, required: true },

  // ── PARENTS ───────────────────────────────────────────────────
  fatherName: String,
  fatherOccupation: String,
  motherName: String,
  motherOccupation: String,

  // ── GUARDIAN DETAILS (NEW) ───────────────────────────────────
  guardianName: { type: String, default: "" },
  guardianRelation: { type: String, default: "" },  // e.g. Uncle, Grandfather
  guardianPhone: { type: Number, default: null },
  guardianAddress: { type: String, default: "" },

  // ── CATEGORY & RELIGION (NEW) ────────────────────────────────
  category: { type: String, default: "" },          // General / OBC / SC / ST / EWS
  religion: { type: String, default: "" },          // Hindu / Muslim / Christian / Sikh / Other
  caste: { type: String, default: "" },             // Optional caste field
  nationality: { type: String, default: "Indian" }, // Default Indian
  motherTongue: { type: String, default: "" },       // e.g. Hindi, Marathi, etc.

  // ── GOVT / ID FIELDS ─────────────────────────────────────────
  aadharNo: { type: String, default: "" },          // Student ka Aadhar Number
  samagraId: { type: String, default: "" },         // Samagra ID (MP Schools)

  // ── VEHICLE / TRANSPORT ──────────────────────────────────────
  isVehicleAssigned: { type: Boolean, default: false },
  vehicleDetails: {
    vehicleNo:    { type: String, default: "" },
    driverName:   { type: String, default: "" },
    driverPhone:  { type: Number, default: null },
    routeDetails: { type: String, default: "" },
    vehicleFees:  { type: Number, default: 0 }
  },

  // ── FEE STATUS ───────────────────────────────────────────────
  feeStatus: [
    {
      feeType:     String,
      installment: String,
      month:       String,
      amount:      Number,
      status:      String,
      mode:        String,
      paymentDate: Date,
      paymentId:   { type: String, default: "" }
    }
  ],

  // ── VEHICLE FEE STATUS ───────────────────────────────────────
  vehicleFeeStatus: [
    {
      installment: String,
      month:       String,
      amount:      Number,
      status:      { type: String, enum: ['Paid', 'Pending'], default: 'Pending' },
      mode:        String,
      paymentDate: Date,
      paymentId:   { type: String, default: "" }
    }
  ],

}, {
  toObject: { id: false, virtuals: true, getters: true },
  toJSON:   { virtuals: true, id: false }
});

studentSchema.index(
  { username: 1, schoolCode: 1 },
  { unique: true }
);

module.exports = mongoose.model("StudentSchema", studentSchema);
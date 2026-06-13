const mongoose = require('mongoose');

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
  fatherOccupation: String,
  motherName: String,
  motherOccupation: String,
  initialClass: String,
  previousSchool: String,
  fees: Number,
  phone: Number,
  address: String,
  photo: String,
  username: { type: String, required: true },
  password: { type: String, required: true },

  // --- NEWLY ADDED GOVT/ID FIELDS ---
  aadharNo: { type: String, default: "" },      // Student ka Aadhar Number
  samagraId: { type: String, default: "" },     // Samagra ID (MP Schools ke liye useful)

  // --- NEWLY ADDED VEHICLE/TRANSPORT DETAILS ---
  isVehicleAssigned: { type: Boolean, default: false }, // Filter karne ke liye ki bacha bus se aata hai ya nahi
  vehicleDetails: {
    vehicleNo: { type: String, default: "" },         // Gaadi ka number
    driverName: { type: String, default: "" },        // Driver ka naam
    driverPhone: { type: Number, default: null },     // Driver ka mobile number
    routeDetails: { type: String, default: "" },       // Optional: Kis route se bacha aata hai
    vehicleFees: { type: Number, default: 0 }
  },

  // Regular Academic Fees Status
  feeStatus: [
    {
      feeType: String,
      installment: String,
      month: String,
      amount: Number,
      status: String,
      mode: String,
      paymentDate: Date,
      paymentId: { type: String, default: "" }
    }
  ],

  // --- VEHICLE FEES INSTALLMENTS ---
  vehicleFeeStatus: [
    {
      installment: String,
      month: String,
      amount: Number,
      status: { type: String, enum: ['Paid', 'Pending'], default: 'Pending' },
      mode: String,
      paymentDate: Date,
      paymentId: { type: String, default: "" }
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
const mongoose = require('mongoose')

const staffSchema = new mongoose.Schema({
  schoolCode: {
    type: String,
    required: true
  },

  name: String,
  empId: String,
  category: String, // accountant, driver, etc.

  salary: Number,
  address: String,
  phone: Number,

  // 🔥 NEW FIELDS
  gender: {
    type: String,
    enum: ["Male", "Female", "Other"]
  },

  dob: Date,
  joiningDate: Date,
  experience: String,
  education: String,

  // driver specific
  vehicle: String,
  vehicleNo: String,

  // image
  photo: String,

  salaryStatus: {
    type: Map,
    of: {
      type: Map,
      of: {
        type: String,
        default: 'pending'
      }
    },
    default: {}
  }

}, { timestamps: true });

module.exports = mongoose.model('StaffSchema', staffSchema);
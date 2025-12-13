const mongoose = require('mongoose')

const studentSchema = new mongoose.Schema({
  name: String,
  id: String,
  class: String,
  DOB: Date,
  fees: Number,
  phone: Number,
  address: String,

  username: { type: String, required: true, unique: true }, // username फ़ील्ड जोड़ा
  password: { type: String, required: true },

  feeStatus: [
    {
      feeType: String,         // Admission / Tuition
      installment: String,     // 1st / 2nd / 3rd / One-time
      month: String,           // Optional: April, July, etc.
      amount: Number,
      status: String,          // Paid / Pending
      mode: String,            // Online / Offline
      paymentDate: Date
    }
  ],

  }, {
  // ✅ FIX: Schema Options यहाँ जोड़े गए
  toObject: {
    // Mongoose के virtual 'id' को disable करें ताकि आपका custom 'id' field use हो सके
    id: false, 
    virtuals: true,
    getters: true,
  },
  toJSON: {
    // Mongoose के virtual 'id' को disable करें
    virtuals: true,
    id: false 
  }
  
})

module.exports = mongoose.model("StudentSchema", studentSchema)


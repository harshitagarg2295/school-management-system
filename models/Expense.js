const mongoose = require('mongoose')

const expenseSchema = new mongoose.Schema({
  schoolCode: {
    type: String,
    required: true
  },
  category: String,
  title: String,
  quantity: String,
  amount: Number,
  paymentDate: Date,
  bill: {
    type: String,
    default: ""
  },
  billPublicId: {
    type: String,
    default: ""
  },
  billType: {
    type: String,
    default: ""
  },
  originalFileName: {
    type: String,
    default: ""
  },
  uniqueKey: { type: String, index: true },  // <-- NEW

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Expense", expenseSchema)
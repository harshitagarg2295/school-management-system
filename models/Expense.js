const mongoose = require('mongoose')

const expenseSchema = new mongoose.Schema({
  category: String,
  title: String,
  quantity: String,
  amount: Number,
  paymentDate: Date,

  uniqueKey: { type: String, index: true },  // <-- NEW
  
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Expense", expenseSchema)
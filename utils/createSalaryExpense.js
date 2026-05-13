const Expense = require("../models/Expense");

// This function is used to automatic create an expense when you paid salary to any teacher or staff

async function createSalaryExpense({ name, amount, month, year, personId, role, schoolCode }) {

    const title = name;
    const category = "Salary Distribution";

    // Month/Year string correction
    month = Number(month);
    year = Number(year);

    // Unique key for delete & duplicate protection
    const uniqueKey = `${role}_${personId}_${year}_${month}`;

    // Prevent duplicate expense
    const existing = await Expense.findOne({ uniqueKey, schoolCode });
    if (existing) return;

    const expense = new Expense({
        title,
        category,
        quantity: 1,
        amount,
        paymentDate: new Date(),
        uniqueKey,
        schoolCode
    });

    await expense.save();
}

module.exports = createSalaryExpense;


const express = require('express');
const router = express.Router();
const Teacher = require('../../models/TeacherSchema');
const Student = require('../../models/StudentSchema');
const Staff = require('../../models/StaffSchema')
const Expense = require('../../models/Expense');
const Fund = require("../../models/FundSchema");
const AdminNotification = require("../../models/AdminNotificationSchema");
const { adminAuth } =  require("../../middlewares/auth");

// Helper: Available FY years
async function getAvailableYears() {
    const minYear = 2024;
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = minYear; y <= currentYear; y++) years.push(y);
    return years.reverse();
}

// Helper: FY date range
function getFYRange(selectedYear) {
    return {
        start: new Date(`${selectedYear}-04-01`),
        end: new Date(`${selectedYear + 1}-03-31`)
    };
}

router.get("/adminDashboard", adminAuth, async (req, res) => {
    const totalStudents = await Student.countDocuments();
    const totalTeachers = await Teacher.countDocuments();
    const totalStaff = await Staff.countDocuments();
    const totalAwards = 15;

    // FY selection
    let selectedYear;
    if (req.query.year) {
        selectedYear = parseInt(req.query.year);
    } else {
        selectedYear = (new Date().getMonth() < 3)
            ? new Date().getFullYear() - 1
            : new Date().getFullYear();
    }

    const availableYears = await getAvailableYears();
    const { start, end } = getFYRange(selectedYear);

    // ========== LINE CHART ==========
    const monthlyIncomeData = new Array(12).fill(0);
    const monthlyExpenseData = new Array(12).fill(0);

    // Income
    const allFees = await Student.find({}, { feeStatus: 1 });
    allFees.forEach(student => {
        if (Array.isArray(student.feeStatus)) {
            student.feeStatus.forEach(fee => {
                if (fee.paymentDate && fee.status.toLowerCase() === "paid") {
                    const d = new Date(fee.paymentDate);
                    if (d >= start && d <= end) {
                        const index = d.getMonth() >= 3 ? d.getMonth() - 3 : d.getMonth() + 9;
                        monthlyIncomeData[index] += fee.amount;
                    }
                }
            });
        }
    });

    // Expenses
    const allExpenses = await Expense.find({ paymentDate: { $gte: start, $lte: end } });
    allExpenses.forEach(exp => {
        const d = new Date(exp.paymentDate);
        const index = d.getMonth() >= 3 ? d.getMonth() - 3 : d.getMonth() + 9;
        monthlyExpenseData[index] += exp.amount;
    });

    // ========== PIE CHART: EXPENSES ==========
    let expensesData = {
        Management: 0,
        Infrastructure: 0,
        Maintenance: 0,
        SalaryDistribution: 0,
        Others: 0,
    };
    allExpenses.forEach(exp => {
        let cat = exp.category.toLowerCase();
        if (cat === "management") expensesData.Management += exp.amount;
        else if (cat === "infrastructure") expensesData.Infrastructure += exp.amount;
        else if (cat === "maintenance") expensesData.Maintenance += exp.amount;
        else if (cat === "salary distribution") expensesData.SalaryDistribution += exp.amount;
        else expensesData.Others += exp.amount;
    });

    // ========== PIE CHART: REVENUE ==========

    let admissionIncome = 0;
    let feesIncome = 0;

    const students = await Student.find({
        "feeStatus.paymentDate": { $gte: start, $lte: end }
    });

    students.forEach(stud => {
        if (stud.feeStatus && Array.isArray(stud.feeStatus)) {
            stud.feeStatus.forEach(fee => {
                if (
                    fee.status.toLowerCase() === "paid" &&
                    fee.paymentDate >= start &&
                    fee.paymentDate <= end
                ) {
                    if (fee.feeType === "Admission Fee") {
                        admissionIncome += fee.amount;
                    } else {
                        feesIncome += fee.amount;
                    }
                }
            });
        }
    });

    // ---- Fund (filter by FY date) ----

    let fundValue;

    // Agar query me fund diya gaya hai
    if (req.query.fund) {
        const newValue = parseInt(req.query.fund);

        // Pehle check karo kya is FY ke andar fund record already exist karta hai
        let fundDoc = await Fund.findOne({
            key: "fund",
            date: { $gte: start, $lte: end }
        });

        if (fundDoc) {
            // ✅ agar exist karta hai to update karo
            fundDoc.value = newValue;
            fundDoc.date = new Date();
            await fundDoc.save();
        } else {
            // ✅ agar exist nahi karta to naya create karo
            fundDoc = await Fund.create({
                key: "fund",
                value: newValue,
                date: new Date()
            });
        }

        fundValue = newValue;
    } else {
        // Agar query me fund nahi diya gaya, to us FY ka latest record uthao
        const fundDoc = await Fund.findOne({
            key: "fund",
            date: { $gte: start, $lte: end }
        }).sort({ date: -1 });

        fundValue = fundDoc ? fundDoc.value : 0;
    }

    const revenueData = {
        Admission: admissionIncome,
        Fees: feesIncome,
        Fund: fundValue
    };

    // Check if data exists
    const hasIncome = monthlyIncomeData.some(val => val > 0);
    const hasExpense = monthlyExpenseData.some(val => val > 0);
    const hasRevenue = (admissionIncome > 0 || feesIncome > 0 || fundValue > 0);

    const noData = !(hasIncome || hasExpense || hasRevenue); //flag for fund input


    const admin = await AdminNotification.findOne() || { notifications: [] };
    res.render("adminDashboard", {
        admin
    });

    // ---------- Render ----------
    res.render("adminDashboard", {
        totalStudents,
        totalTeachers,
        totalStaff,
        totalAwards,
        availableYears,
        selectedYear,
        monthlyIncomeData,
        monthlyExpenseData,
        expensesData,
        revenueData,
        fundValue,
        noData,
        admin
    })
})

module.exports = router

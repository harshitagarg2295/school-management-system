
const express = require("express");
const router = express.Router();
const Student = require("../../models/StudentSchema");
const Expense = require('../../models/Expense');
const AdminNotification = require("../../models/AdminNotificationSchema");
const { adminAuth } = require("../../middlewares/auth");


router.get("/school_fees_collection", adminAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  const classFilter = req.query.classFilter;
  const statusFilter = req.query.statusFilter;
  const selectedYear = parseInt(req.query.year) || new Date().getFullYear();

  let filter = { schoolCode };

  if (classFilter && classFilter !== "All Classes") {
    filter.class = classFilter;
  }

  const allStudents = await Student.find(filter).sort({ name: 1 });

  // Prepare monthly graph data
  const monthlyCollection = new Array(12).fill(0);

  allStudents.forEach(student => {
    student.feeStatus.forEach(fee => {
      if (fee.status === "Paid" && fee.paymentDate) {
        const date = new Date(fee.paymentDate);
        const jsMonth = date.getMonth(); // Jan = 0
        const jsYear = date.getFullYear();

        // Determine financial year for this payment
        const feeFinancialYear = jsMonth >= 3 ? jsYear : jsYear - 1;

        if (feeFinancialYear === selectedYear) {
          const fyMonth = (jsMonth + 9) % 12; // Apr=0 ... Mar=11
          monthlyCollection[fyMonth] += fee.amount;
        }
      }
    });
  });

  let totalAmount = 0;
  let totalReceived = 0;

  let processedStudents = allStudents.map((student) => {
    let paidFees = 0;

    // Calculate paid fees for current fianancial year
    student.feeStatus.forEach((fee) => {
      // if (fee.status === "Paid" && fee.feeType !== "Admission Fee") {
      //   paidFees += fee.amount;
      // }
      if (
        fee.status === "Paid" && fee.paymentDate) {
        const d = new Date(fee.paymentDate);
        const fy = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;

        if (fy === selectedYear) {
          paidFees += fee.amount;
        }
      }
    });

    const remainingFees = student.fees - paidFees;
    // const allPaid = student.feeStatus
    //   .filter(fee => fee.feeType !== "Admission Fee")
    //   .every(fee => fee.status === "Paid");

    const allPaid = student.feeStatus.every(
      fee => fee.status === "Paid"
    );


    totalAmount += student.fees;
    totalReceived += paidFees;

    return {
      ...student.toObject(),
      paidFees,
      remainingFees,
      overallStatus: allPaid ? "Paid" : "Pending"
    };
  });

  // Get all years for which payments exist
  const yearSet = new Set();
  allStudents.forEach(student => {
    student.feeStatus.forEach(fee => {
      if (fee.paymentDate) {
        const m = new Date(fee.paymentDate).getMonth();
        const y = new Date(fee.paymentDate).getFullYear();
        const fy = m >= 3 ? y : y - 1;
        yearSet.add(fy);
      }
    });
  });
  const availableYears = Array.from(yearSet).sort((a, b) => b - a);


  // Filter for status
  if (statusFilter && statusFilter !== "All Status") {
    processedStudents = processedStudents.filter(student =>
      statusFilter === "Paid"
        ? student.overallStatus === "Paid"
        : student.overallStatus === "Pending"
    );
  }

  const totalPending = totalAmount - totalReceived;

  // const expenses = await Expense.find();

  const expenses = await Expense.find({
    schoolCode,
    date: {
      $gte: new Date(`${selectedYear}-04-01`),
      $lte: new Date(`${selectedYear + 1}-03-31`)
    }
  });

  let totalExpense = 0;

  expenses.forEach(exp => {
    totalExpense += exp.amount;
  })


  const totalProfit = totalReceived - totalExpense;

  const classList = await Student.distinct("class", { schoolCode });
  const sortedClasses = ["All Classes", ...classList.sort()];

  const admin = await AdminNotification.findOne({ schoolCode }) || { notifications: [] };

  res.render("Admin/school_fees_collection", {
    students: processedStudents,
    classFilter,
    statusFilter,
    sortedClasses,
    totalAmount,
    totalReceived,
    totalPending,
    totalProfit,
    monthlyCollection,
    selectedYear,
    availableYears,
    admin
  });
});

module.exports = router;

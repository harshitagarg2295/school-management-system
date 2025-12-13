
const express = require("express");
const router = express.Router();
const Student = require("../../models/StudentSchema");
const AdminNotification = require("../../models/AdminNotificationSchema");
const { adminAuth } =  require("../../middlewares/auth");


router.get("/school_fees_collection", adminAuth, async (req, res) => {
  const classFilter = req.query.classFilter;
  const statusFilter = req.query.statusFilter;
  const selectedYear = parseInt(req.query.year) || new Date().getFullYear();

  let filter = {};

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

    student.feeStatus.forEach((fee) => {
      if (fee.status === "Paid" && fee.feeType !== "Admission Fee") {
        paidFees += fee.amount;
      }
    });

    const remainingFees = student.fees - paidFees;
    const allPaid = student.feeStatus
      .filter(fee => fee.feeType !== "Admission Fee")
      .every(fee => fee.status === "Paid");

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

  const classList = await Student.distinct("class");
  const sortedClasses = ["All Classes", ...classList.sort()];

   const admin = await AdminNotification.findOne() || { notifications: [] };

  res.render("school_fees_collection", {
    students: processedStudents,
    classFilter,
    statusFilter,
    sortedClasses,
    totalAmount,
    totalReceived,
    totalPending,
    monthlyCollection,
    selectedYear,
    availableYears,
    admin
  });
});

module.exports = router;

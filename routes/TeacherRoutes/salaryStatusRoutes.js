const express = require("express");
const router = express.Router();
const moment = require("moment");

const Teacher = require("../../models/TeacherSchema")
const SalaryStatus = require("../../models/TeacherSalaryStatus");
const { teacherAuth } = require("../../middlewares/auth");

// 👉 Teacher Salary Status Page
router.get("/teachers/salary", teacherAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  const teacherId = req.session.teacherId; 
  if (!teacherId) {
    return res.redirect("/login");
  }

  const teacher = await Teacher.findOne({ _id: teacherId, schoolCode });
  if (!teacher) {
    return res.redirect("/login");
  }

  // DB se saare months ke salary status fetch karo
  const salaryRecords = await SalaryStatus.find({ teacherId, schoolCode })
    .sort({ year: 1, month: 1 });

  // 🧠 LIVE REAL-TIME TIME CHECKS
  const currentMoment = moment();
  const currentYear = currentMoment.year();
  const currentMonth = currentMoment.month() + 1; // moment me 0-11 hota h, hume 1-12 chahiye

  // Records ko filter aur format karo dynamic rules ke mutabik
  const salaryData = [];

  salaryRecords.forEach(rec => {
    // RULE 1: Future ke saal ya isi saal me future ke mahine ka card bilkul nahi aayega
    if (rec.year > currentYear || (rec.year === currentYear && rec.month > currentMonth)) {
      return; // Chupchaap skip kar do, naye card jaise-jaise mahina aayega automatic add honge
    }

    // RULE 2: May (5) aur June (6) ke liye special check
    if (rec.month === 5 || rec.month === 6) {
      // Agar presentDays ya absentDays dono 0 hain (matlab koi attendance data nahi dala gya), 
      // aur status bhi pending hai, toh vacation month ko hide rakho.
      if ((rec.presentDays || 0) === 0 && (rec.absentDays || 0) === 0 && rec.status === "pending") {
        return; // Skip May/June card
      }
    }

    // Agar upar wale filters pass ho gaye, toh card ko list me add karo
    const monthName = moment().month(rec.month - 1).format("MMMM"); // 1 -> January, etc.
    
    salaryData.push({
      monthYear: `${monthName} ${rec.year}`,
      month: rec.month,
      year: rec.year,
      totalSalary: rec.totalSalary || 0,
      payableSalary: rec.payableSalary || 0,
      status: rec.status,
      presentDays: rec.presentDays,
      absentDays: rec.absentDays,
      lateCount: rec.lateCount,
      totalAbsent: rec.totalAbsent,
      paidOn: rec.paidOn ? moment(rec.paidOn).format("DD MMM YYYY") : "-",
    });
  });

  res.render("Teachers/salaryStatus", { salaryData, teacher });
});

// Salary Receipt Download Route

router.get("/teachers/download-receipt/:month/:year", teacherAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  const { month, year } = req.params;
  const teacherId = req.session.teacherId; 

  try {
    const record = await SalaryStatus.findOne({
      teacherId,
      month,
      year,
      schoolCode
    }).populate({
      path: "teacherId",
      match: { schoolCode }
    });

    if (!record) {
      return res.status(404).send("No salary record found for this month.");
    }

   let formattedPaidOn = "-";
    
    if (record.status === "paid") {
      if (record.paidOn) {
        formattedPaidOn = moment(record.paidOn).format("DD MMM YYYY");
      } else {
        // Agar admin panel me save karna bhool gaye, toh jab record generate hua tab ki date safe side ke liye
        formattedPaidOn = moment().format("DD MMM YYYY"); 
      }
    }

    res.render("Teachers/salaryReceipt", {
      teacher: record.teacherId,
      month,
      year,
      status: record.status,
      paidOn: formattedPaidOn,
      presentDays: record.presentDays,
      absentDays: record.absentDays,
      lateCount: record.lateCount,
      totalAbsent: record.totalAbsent,
      totalSalary: record.totalSalary,
      deduction: record.deduction || 0,
      payableSalary: record.payableSalary
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating receipt");
  }
});



module.exports = router
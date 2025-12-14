const express = require("express");
const router = express.Router();
const moment = require("moment");

const Teacher = require("../../models/TeacherSchema")
const SalaryStatus = require("../../models/TeacherSalaryStatus");
const {teacherAuth} =  require("../../middlewares/auth");

// 👉 Teacher Salary Status Page
router.get("/teachers/salary",teacherAuth, async (req, res) => {

  const teacherId = req.session.teacherId; // मान लो teacher login से id आ रही है
  if (!teacherId) {
    return res.redirect("/teacher.html");
  }

  const teacher = await Teacher.findById(teacherId);


  // DB से सारे months के salary status fetch करो
  const salaryRecords = await SalaryStatus.find({ teacherId })
    .sort({ year: 1, month: 1 });

  // Month Name + Year convert करो
  const salaryData = salaryRecords.map(rec => {
    const monthName = moment().month(rec.month - 1).format("MMMM"); // 1->Jan, etc
    return {
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
    };
  });

  res.render("Teachers/salaryStatus", { salaryData, teacher });

});


// Salary Receipt Download Route

router.get("/teachers/download-receipt/:month/:year",teacherAuth, async (req, res) => {
  const { month, year } = req.params;
  const teacherId = req.session.teacherId; // 👈 teacher login ID session se lo


  try {
    const record = await SalaryStatus.findOne({ teacherId, month, year })
      .populate("teacherId");

    if (!record) {
      return res.status(404).send("No salary record found for this month.");
    }


    res.render("Teachers/salaryReceipt", {
      teacher: record.teacherId,
      month,
      year,
      status: record.status,
      paidOn: record.paidOn,
      presentDays:  record.presentDays,
      absentDays: record.absentDays,
      lateCount: record.lateCount,
      totalAbsent: record.totalAbsent,
      totalSalary: record.totalSalary,
      payableSalary: record.payableSalary
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating receipt");
  }
});



module.exports = router
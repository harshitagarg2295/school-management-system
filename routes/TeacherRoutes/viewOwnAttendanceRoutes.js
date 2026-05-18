const express = require("express");
const moment = require("moment");
const router = express.Router();

const Teacher = require("../../models/TeacherSchema");
const Attendance = require("../../models/TeacherAttendance");
const Holiday = require("../../models/Holiday");
const SalaryStatus = require("../../models/TeacherSalaryStatus");
const { teacherAuth } = require("../../middlewares/auth");

// Teacher Attendance View
router.get("/teachers/view-own-attendance", teacherAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;

  // मान लो req.session.teacherId से teacher logged in है
  const teacherId = req.session.teacherId;
  if (!teacherId) {
    return res.redirect("/login");
  }

  // teacher fetch
  const teacher = await Teacher.findOne({
    _id: teacherId,
    schoolCode
  });

  // Month aur Year params
  let month = parseInt(req.query.month) || moment().month() + 1; // 1-based
  let year = parseInt(req.query.year) || moment().year();

  // Days in month
  const daysInMonth = moment(`${year}-${month}`, "YYYY-MM").daysInMonth();


  // Attendance fetch (date range se)
  const startDate = moment(`${year}-${month}-01`, "YYYY-MM-DD").startOf("day").toDate();
  const endDate = moment(`${year}-${month}-${daysInMonth}`, "YYYY-MM-DD").endOf("day").toDate();


  // Attendance fetch for that month

  const attendanceDocs = await Attendance.find({
    teacherId: teacherId,
    schoolCode,
    date: { $gte: startDate, $lte: endDate }
  });

  // convert attendance into map { day_1: "P", day_2: "A" ... }
  const attendanceMap = {};
  attendanceDocs.forEach(att => {
    const day = moment(att.date).date();
    attendanceMap[`day_${day}`] = att.status; // "P" / "A"
  });

  // Salary Calculation 
  let statusDoc = await SalaryStatus.findOne({
    teacherId: teacherId,
    month: Number(month),
    year: Number(year),
    schoolCode
  });

  // Variables initialize karo default values ke sath (agar is mahine ki attendance abhi tak nahi bani)
  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let totalAbsent = 0;
  let payableSalary = 0;
  let deduction = 0;
  let perDaySalary = Math.round(teacher.salary / daysInMonth);
  let salaryStatus = "pending"; // Paid/Pending batane ke liye

  if (statusDoc) {
    // Agar admin portal par attendance generate ho chuki hai, toh exact real data nikal lo
    presentCount = statusDoc.presentDays || 0;
    absentCount = statusDoc.absentDays || 0;
    lateCount = statusDoc.lateCount || 0;
    totalAbsent = statusDoc.totalAbsent || 0;
    payableSalary = statusDoc.payableSalary || 0;
    deduction = statusDoc.deduction || 0;
    salaryStatus = statusDoc.status || "pending";
  } else {
    // Fallback: Agar is month ki attendance admin ne abhi tak touch nahi ki, toh live calculation se counts nikal lo
    presentCount = attendanceDocs.filter(a => a.status === "P" || a.status === "L").length;
    absentCount = attendanceDocs.filter(a => a.status === "A").length;
    lateCount = attendanceDocs.filter(a => a.status === "L").length;

    // Note: Naye month me jab tak admin view nahi karega tab tak salary 0 dikhegi jaisa admin panel pe chal raha hai
    payableSalary = 0;
    deduction = 0;
  }

  // Holidays fetch
  const holidayDocs = await Holiday.find({
    role: "teacher",
    schoolCode,
    date: {
      $gte: moment(`${year}-${month}-01`, "YYYY-MM-DD").startOf("day").toDate(),
      $lte: moment(`${year}-${month}-${daysInMonth}`, "YYYY-MM-DD").endOf("day").toDate()
    }
  });

  const holidays = holidayDocs.map(h => moment(h.date).date());

  // Reason object
  const holidayReasons = {};
  holidayDocs.forEach(h => {
    holidayReasons[moment(h.date).date()] = h.reason;
  });

  // Sundays
  const sundays = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const current = moment(`${year}-${month}-${d}`, "YYYY-MM-DD");
    if (current.day() === 0) {
      sundays.push(d);
    }
  }

  const today = parseInt(moment().format("D"));

  res.render("Teachers/viewOwnAttendance", {
    teacher,
    moment,
    month,
    year,
    daysInMonth,
    attendanceMap,
    holidays,
    holidayReasons,
    sundays,
    holidayDocs,
    today,
    today,
    presentCount,
    absentCount,
    lateCount,
    totalAbsent,      
    perDaySalary,    
    payableSalary,
    deduction,       
    salaryStatus,
  });
});

module.exports = router;

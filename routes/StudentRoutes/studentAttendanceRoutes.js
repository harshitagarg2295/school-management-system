const express = require("express");
const moment = require("moment");
const router = express.Router();

const Student = require("../../models/StudentSchema");
const Attendance = require("../../models/StudentAttendance");
const Holiday = require("../../models/Holiday");
const {studentAuth} =  require("../../middlewares/auth");

// Student Attendance View
router.get("/students/view-attendance",studentAuth, async (req, res) => {

  const studentId = req.session.studentId.id;

  // मान लो req.session.studentId से student logged in है
  if (!req.session.studentId || !req.session.studentId.id) {
    return res.redirect("/student.html");
  }

  // student fetch
  const student = await Student.findById(req.session.studentId.id);

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
    studentId: studentId,
    date: { $gte: startDate, $lte: endDate }
  });

  // convert attendance into map { day_1: "P", day_2: "A" ... }
  const attendanceMap = {};
  attendanceDocs.forEach(att => {
    const day = moment(att.date).date();
    attendanceMap[`day_${day}`] = att.status; // "P" / "A"
  });

   const presentCount = attendanceDocs.filter(a => a.status === "P").length;
  const absentCount = attendanceDocs.filter(a => a.status === "A").length;

  // Holidays fetch
  const holidayDocs = await Holiday.find({
    role: "student",
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

  res.render("Students/studentAttendance", {
    student,
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
    presentCount,
    absentCount
  });
});

module.exports = router;

const express = require("express");
const moment = require("moment");
const router = express.Router();

const Teacher = require("../../models/TeacherSchema");
const Attendance = require("../../models/TeacherAttendance");
const Holiday = require("../../models/Holiday");
const {teacherAuth} =  require("../../middlewares/auth");

// Teacher Attendance View
router.get("/teachers/view-own-attendance",teacherAuth, async (req, res) => {

  // मान लो req.session.teacherId से teacher logged in है
  const teacherId = req.session.teacherId;
  if (!teacherId) {
    return res.redirect("/teacher.html");
  }

  // teacher fetch
  const teacher = await Teacher.findById(teacherId);

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
  const lateCount = attendanceDocs.filter(a => a.status === "L").length;

  // Salary calculation:

  const totalAbsent = absentCount + Math.floor(lateCount / 2);

  const perDaySalary = Math.round(teacher.salary / daysInMonth);

  const payableSalary = teacher.salary - totalAbsent * perDaySalary;


  // Holidays fetch
  const holidayDocs = await Holiday.find({
    role: "teacher",
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
    presentCount,
    absentCount,
    lateCount,
    payableSalary,
  });
});

module.exports = router;

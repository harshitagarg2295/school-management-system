const express = require('express')
const router = express.Router()
const StudentAttendance = require("../../models/StudentAttendance");
const { studentAuth } = require("../../middlewares/auth");

router.get("/studentDashboard", studentAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;

  const Student = req.app.get("Student");

  // Agar session me studentId save h to uske basis pe fetch karo
  if (!req.session.studentId || !req.session.studentId.id) {
    return res.redirect("/login");; // agar login nahi h to wapas login page bhej do
  }

  const student = await Student.findOne({
    _id: req.session.studentId.id,
    schoolCode
  });
  if (!student) {
    return res.redirect("/login");
  }

  const attendance = await StudentAttendance.find({
    studentId: student._id,
    schoolCode
  });

  // render student dashboard aur student ka data bhejo
  res.render("Students/studentDashboard", { student, attendance });
});

module.exports = router
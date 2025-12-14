const express = require ('express')
const router = express.Router()
const StudentAttendance = require("../../models/StudentAttendance");
const {studentAuth} =  require("../../middlewares/auth");

router.get("/studentDashboard", studentAuth,  async (req, res) => {
  const Student = req.app.get("Student");

  // Agar session me studentId save h to uske basis pe fetch karo
  if (!req.session.studentId || !req.session.studentId.id) {
    return res.redirect("/student.html"); // agar login nahi h to wapas login page bhej do
  }

  const student = await Student.findById(req.session.studentId.id);
  const attendance = await StudentAttendance.find({ studentId: student._id });

  // render student dashboard aur student ka data bhejo
  res.render("Students/studentDashboard", { student, attendance });
});

module.exports = router
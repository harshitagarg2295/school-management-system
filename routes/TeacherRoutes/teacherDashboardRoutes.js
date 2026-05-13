
const express = require('express');
const router = express.Router();
const Student = require("../../models/StudentSchema");
const TeacherAttendance = require("../../models/TeacherAttendance");
const { teacherAuth } = require("../../middlewares/auth");


router.get("/teacherDashboard", teacherAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;

  const Teacher = req.app.get("Teacher");
  const Class = req.app.get("Class");

  if (!req.session.teacherId) {
    return res.redirect("/login");
  }

  const teacher = await Teacher.findOne({
    _id: req.session.teacherId,
    schoolCode
  });

  if (!teacher) {
  return res.redirect("/login");
}
  const attendance = await TeacherAttendance.find({ teacherId: teacher._id, schoolCode });

  res.render("Teachers/teacherDashboard", { teacher, attendance });
});


module.exports = router

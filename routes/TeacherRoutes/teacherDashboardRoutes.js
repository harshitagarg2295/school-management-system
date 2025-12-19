
const express = require('express');
const router = express.Router();
const Student = require("../../models/StudentSchema");
const TeacherAttendance = require("../../models/TeacherAttendance");
const {teacherAuth} =  require("../../middlewares/auth");


router.get("/teacherDashboard", teacherAuth, async (req, res) => {
  const Teacher = req.app.get("Teacher");
  const Class = req.app.get("Class"); 

  if (!req.session.teacherId) {
    return res.redirect("/teacher.html");
  }

  const teacher = await Teacher.findById(req.session.teacherId);
    const attendance = await TeacherAttendance.find({ teacherId: teacher._id });
  

  // DB se distinct class names fetch karo aur sort karo
  const classList = await Student.distinct("class");
  const sortedClasses = ["Select Class", ...classList.sort()];

  res.render("Teachers/teacherDashboard", { teacher, sortedClasses, attendance});
});


router.post("/update-class-teacher",teacherAuth, async (req, res) => {
  const Teacher = req.app.get("Teacher");

  if (!req.session.teacherId) {
    return res.redirect("/teacher.html");
  }

  const { classTeacher, assignedClass } = req.body;

  await Teacher.findByIdAndUpdate(req.session.teacherId, {
    classTeacher,
    assignedClass: classTeacher === "yes" ? assignedClass : null
  });

  res.redirect("/teacherDashboard");
});

module.exports = router

const express = require("express");
const router = express.Router();
const Student = require("../../models/StudentSchema");
const Result = require("../../models/StudentResultSchema"); // your result model
const { adminAuth, studentAuth } = require("../../middlewares/auth");


router.get("/students/view-result", studentAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  if (!req.session.studentId || !req.session.studentId.id) {
    return res.redirect("/login");;
  }

  const studentId = req.session.studentId.id;


  const student = await Student.findOne({
    _id: studentId,
    schoolCode
  });

  if (!student) return res.status(404).send("Student not found");

  const results = await Result.find({
    studentId,
    schoolCode
  }).sort({ createdAt: -1 });

  const exams = results.map(r => ({
    id: r._id,
    label: `${r.examType} - ${r.examName} (${r.year})`
  }));

  let selectedResult = null;
  let marksPlain = null;
  const selectedExamId = req.query.exam || null;

  if (selectedExamId) {
    const found = results.find(r => String(r._id) === selectedExamId);
    if (found) {
      selectedResult = found.toObject();
      // ✅ safest way to convert Mongoose Map to plain object
      if (found.marks instanceof Map) {
        marksPlain = Object.fromEntries(found.marks);
      } else {
        marksPlain = found.marks;
      }
    }
  }

  res.render("Students/viewResult", { student, exams, selectedResult, marksPlain, role: "student" });
});

// This route is to render student result page on admin dashboard

router.get("/admin/view-result/:studentId", adminAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  const studentId = req.params.studentId;
  const student = await Student.findOne({
    _id: studentId,
    schoolCode
  });

  if (!student) return res.status(404).send("Student not found");

  const results = await Result.find({
    studentId,
    schoolCode
  }).sort({ createdAt: -1 });

  const exams = results.map(r => ({
    id: r._id,
    label: `${r.examType} - ${r.examName} (${r.year})`
  }));

  let selectedResult = null;
  let marksPlain = null;
  const selectedExamId = req.query.exam || null;

  if (selectedExamId) {
    const found = results.find(r => String(r._id) === selectedExamId);
    if (found) {
      selectedResult = found.toObject();
      marksPlain = found.marks instanceof Map ? Object.fromEntries(found.marks) : found.marks;
    }
  }

  res.render("Students/viewResult", { student, exams, selectedResult, marksPlain, role: "admin" });
});




module.exports = router;


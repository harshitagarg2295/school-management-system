
const express = require("express");
const router = express.Router();

const Student = require("../../models/StudentSchema");
const Teacher = require("../../models/TeacherSchema");
const StudentResult = require("../../models/StudentResultSchema");
const {teacherAuth} =  require("../../middlewares/auth");

// subjects per class (example)
const classSubjects = {
  "1": ["Hindi", "English", "Math", "GK", "Computer", "Drawing"],
  "2": ["Hindi", "English", "Math", "GK", "Computer", "Drawing"],
  "3": ["Hindi", "English", "Math", "GK", "Computer", "Drawing"],
  "4": ["Hindi", "English", "Math", "EVS", "GK", "Computer", "Drawing"],
  "5": ["Hindi", "English", "Math", "Science", "EVS"],
  "6": ["Hindi", "English", "Math", "Science", "Social Science", "Sanskrit"],
  "7": ["Hindi", "English", "Math", "Science", "Social Science", "Sanskrit"],
  "8": ["Hindi", "English", "Math", "Science", "Social Science", "Sanskrit"],
  "9": ["Hindi", "English", "Math", "Science", "Social Science", "Sanskrit"],
  "10": ["Hindi", "English", "Math", "Science", "Social Science", "Sanskrit"],
};
function getSubjectsForClass(cls) {
  return classSubjects[String(cls)] || ["Hindi", "English", "Math", "Drawing"];
}

const months = ["January", "February", "March", "April", "July", "August", "September", "October", "November", "December"];
const examSubtypes = ["Quarterly", "Half-Yearly", "Annual", "Pre-board"];

// ---------- GET ----------

router.get("/teachers/submit-result",teacherAuth, async (req, res) => {
  try {

    const teacherId = req.session.teacherId;
    const teacher = await Teacher.findById(teacherId);

    // ✅ convert subjects/classes to array
    const teacherSubjects = teacher.subject.split(",").map(s => s.trim());
    const teacherClasses = teacher.class.split(",").map(c => c.trim());

    // ✅ save in session
    req.session.teacherSubjects = teacherSubjects;
    req.session.teacherClasses = teacherClasses;

    const classList = await Student.distinct("class");
    const classOrder = [
      "Nursery", "LKG", "UKG",
      "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
      "11", "12"
    ];

    classList.sort((a, b) => {
      const idxA = classOrder.indexOf(a);
      const idxB = classOrder.indexOf(b);

      // Jo classOrder me na ho, unko end me push kar do
      return (idxA === -1 ? Infinity : idxA) - (idxB === -1 ? Infinity : idxB);
    });

    const classFilter = req.query.classFilter || "";
    const examType = req.query.type || "";
    const examName = req.query.sub || "";
    const year = new Date().getFullYear();

    let students = [];
    let resultsMap = {};
    if (classFilter && classFilter !== "") {
      students = await Student.find({ class: classFilter }).sort({ name: 1 });

      // अब हर student का id string बना दो
      students = students.map(stu => ({
        ...stu.toObject(),
        _idStr: stu._id.toString()
      }));

      const results = await StudentResult.find({
        class: classFilter,
        examType,
        examName,
        year
      }).lean();;

      results.forEach(r => {
        resultsMap[String(r.studentId)] = r;
      });

    }

    res.render("Teachers/submitResult", {
      classList,
      classFilter,
      examType,
      examName,
      months,
      examSubtypes,
      year,
      subjectsForClass: getSubjectsForClass(classFilter),
      students,
      resultsMap,
      teacherSubjects,
      teacherClasses
    });
  } catch (err) {
    console.error("Error in GET /teachers/submit-result:", err);
    res.status(500).send("Error loading page");
  }
});



// ---------- POST ----------
router.post("/teachers/submit-result", async (req, res) => {
  const { classFilter, examType, examName, outOf, year, marks } = req.body;
  const teacherId = req.session.teacherId;

  if (!examType || !examName) {
    return res.send(`<script>alert("Please select exam type!"); window.history.back();</script>`);
  }

  for (const studentId of Object.keys(marks || {})) {
    const studentMarks = marks[studentId];
    const marksMap = {};
    Object.entries(studentMarks).forEach(([sub, val]) => {
      const n = val === "" ? null : Number(val);
      if (n !== null && !isNaN(n)) marksMap[sub] = n;
    });

    // पहले का result निकालो
    const existing = await StudentResult.findOne({
      studentId, class: classFilter, examType, examName, year
    });

    let newMarks = { ...(existing?.marks?.toObject?.() || {}) };
    newMarks = { ...newMarks, ...marksMap };   // merge करो

    await StudentResult.findOneAndUpdate(
      { studentId, class: classFilter, examType, examName, year },
      { $set: { marks: newMarks, outOf, teacherId, updatedAt: new Date() } },
      { upsert: true, new: true }
    );
  }
  res.redirect(`/teachers/submit-result?classFilter=${classFilter}&type=${examType}&sub=${examName}&year=${year}`);

});


module.exports = {
  router,
  getSubjectsForClass   // ✅ export the helper
};
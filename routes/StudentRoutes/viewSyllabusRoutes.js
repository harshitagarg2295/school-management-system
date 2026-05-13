// routes/StudentRoutes/viewSyllabusRoutes.js
const express = require("express");
const router = express.Router();
const Syllabus = require("../../models/Syllabus"); // Your DB model
const { studentAuth } = require("../../middlewares/auth");

// Monthly Test
router.get("/students/view-monthly-test/syllabus", studentAuth, async (req, res) => {
    const schoolCode = req.session.schoolCode;
    const studentClass = req.session.studentId.class; // ✅ student's class from session
    const period = req.query.period || null;

    let subjects = [];
    let savedSyllabus = null;

    if (period) {
        savedSyllabus = await Syllabus.findOne({
            class: studentClass,
            type: "monthly",
            period,
            schoolCode
        });
        subjects = savedSyllabus ? savedSyllabus.subjects.map(s => s.name) : [];
    }

    res.render("Students/viewSyllabus", {
        type: "monthly",
        selectedPeriod: period,
        subjects,
        savedSyllabus
    });
});

// Exams
router.get("/students/view-exams/syllabus", studentAuth, async (req, res) => {
    const schoolCode = req.session.schoolCode;
    const studentClass = req.session.studentId.class;;
    const period = req.query.period || null;

    let subjects = [];
    let savedSyllabus = null;

    if (period) {
        savedSyllabus = await Syllabus.findOne({
            class: studentClass,
            type: "exams",
            period,
            schoolCode
        });
        subjects = savedSyllabus ? savedSyllabus.subjects.map(s => s.name) : [];
    }

    res.render("Students/viewSyllabus", {
        type: "exams",
        selectedPeriod: period,
        subjects,
        savedSyllabus
    });
});

module.exports = router;

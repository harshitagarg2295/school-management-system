// routes/StudentRoutes/viewSyllabusRoutes.js
const express = require("express");
const router = express.Router();
const moment = require('moment')
const Timetable = require("../../models/Timetable"); // Your DB model
const {studentAuth} =  require("../../middlewares/auth");

// Monthly Test
router.get("/students/view-monthly-test/timetable", studentAuth,async (req, res) => {
    const studentClass = req.session.studentId.class; // ✅ student's class from session
    const period = req.query.period || null;

    let subjects = [];
    let savedTimetable = null;

    if (period) {
        savedTimetable = await Timetable.findOne({
            class: studentClass,
            type: "monthly",
            period
        });
        subjects = savedTimetable ? savedTimetable.subjects.map(s => s.name) : [];
    }

    res.render("viewTimetable", {
        type: "monthly",
        selectedPeriod: period,
        subjects,
        savedTimetable,
        moment
    });
});

// Exams
router.get("/students/view-exams/timetable",studentAuth, async (req, res) => {
    const studentClass = req.session.studentId.class;;
    const period = req.query.period || null;

    let subjects = [];
    let savedTimetable = null;

    if (period) {
        savedTimetable = await Timetable.findOne({
            class: studentClass,
            type: "exams",
            period
        });
        subjects = savedTimetable ? savedTimetable.subjects.map(s => s.name) : [];
    }

    res.render("viewTimetable", {
        type: "exams",
        selectedPeriod: period,
        subjects,
        savedTimetable,
        moment
    });
});

module.exports = router;

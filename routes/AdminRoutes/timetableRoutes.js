const express = require("express");
const router = express.Router();
const moment = require('moment')
const Student = require("../../models/StudentSchema");
const Timetable = require("../../models/Timetable");
const { getSubjectsForClass } = require("../../routes/TeacherRoutes/submitResultRoutes");
const { adminAuth } = require("../../middlewares/auth");

// --- 1. Common GET Route for Timetable View (Filter Logic and Data Loading) ---
router.get("/get-timetable-view/:type/:className/:period", adminAuth, async (req, res) => {
    const schoolCode = req.session.schoolCode;
    const { type, className, period } = req.params;

    const classList = await Student.distinct("class", { schoolCode });

    // Fetch saved timetable first
    let savedTimetable = null;
    if (className !== 'null' && period !== 'null') {
        savedTimetable = await Timetable.findOne({
            class: className,
            type,
            period,
            schoolCode   // 🔥 add
        });
    }

    // Prepare subjects list
    let subjects = className === 'null' ? [] : getSubjectsForClass(className);

    // If a timetable exists, sort it by date and reorder subjects
    if (savedTimetable && savedTimetable.subjects.length > 0) {
        savedTimetable.subjects.sort((a, b) => new Date(a.date) - new Date(b.date));
        subjects = savedTimetable.subjects.map(s => s.name);
    }

    // Handle selection states
    const selectedClass = className === 'null' ? "" : className;
    const selectedPeriod = period === 'null' ? "" : period;

    res.render("Admin/timetable", {
        type,
        classList,
        selectedClass,
        selectedPeriod,
        subjects,
        savedTimetable,
        moment
    });
});


// --- 2. Existing Initial GET Routes Update (No Default Class) ---

router.get("/add-timetable/monthly-test", adminAuth, async (req, res) => {
    const schoolCode = req.session.schoolCode;
    return res.redirect(`/get-timetable-view/monthly/null/null`);
});

router.get("/add-timetable/exams", adminAuth, async (req, res) => {
    const schoolCode = req.session.schoolCode;
    return res.redirect(`/get-timetable-view/exams/null/null`);
});


// --- 3. POST Route (Save Timetable) Update ---

router.post("/save-timetable", adminAuth, async (req, res) => {
    const schoolCode = req.session.schoolCode;
    const { className, type, period } = req.body;

    // Frontend validation hone ke karan, yahan className aur period available honge.

    const subjectsData = [];
    for (const key in req.body) {
        if (!["className", "type", "period", "_id"].includes(key) && req.body[key]) {
            subjectsData.push({
                name: key,
                date: new Date(req.body[key])
            });
        }
    }

    // ✅ Sort by date ascending
    subjectsData.sort((a, b) => new Date(a.date) - new Date(b.date));

    try {
        // Find and Update, agar already exist karta hai
        await Timetable.findOneAndUpdate(
            { class: className, type, period, schoolCode }, // 🔥
            { $set: { subjects: subjectsData, schoolCode } },
            { upsert: true, new: true }
        );

        // Save hone ke baad, selected class aur period ke saath wapas redirect karein
        const redirectUrl = `/get-timetable-view/${type}/${className}/${period}`;
        return res.redirect(redirectUrl);

    } catch (error) {
        console.error("Error saving timetable:", error);
        // Error par bhi, selected class/period ke saath wapas bhej sakte hain
        const redirectUrl = `/get-timetable-view/${type}/${className}/${period}`;
        return res.redirect(redirectUrl);
    }
});

module.exports = router;
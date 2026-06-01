const express = require("express");
const router = express.Router();
const Student = require("../../models/StudentSchema");
const Syllabus = require("../../models/Syllabus"); // Assuming you have this model
const { getSubjectsForClass } = require("../../routes/TeacherRoutes/submitResultRoutes");
const { teacherAuth } = require("../../middlewares/auth");

// --- 1. Common GET Route for Syllabus View (Filter Logic and Data Loading) ---
router.get("/teachers/get-syllabus-view/:type/:className/:period", teacherAuth, async (req, res) => {
    try {
        const { type, className, period } = req.params;

        const schoolCode = req.session.schoolCode;

        const classList = await Student.distinct("class", { schoolCode });

        // Subjects only load honge jab class selected ho
        const subjects = className === 'null' ? [] : getSubjectsForClass(className);

        // Saved Syllabus Data Load karna
        let savedSyllabus = null;
        if (className !== 'null' && period !== 'null') {
            savedSyllabus = await Syllabus.findOne({ class: className, type, period, schoolCode });
        }

        // Parameters set karna, 'null' ko "" se replace karein
        const selectedClass = className === 'null' ? "" : className;
        const selectedPeriod = period === 'null' ? "" : period;

        res.render("Teachers/syllabus", {
            type,
            classList,
            selectedClass,    // For selection state
            selectedPeriod,   // For selection state
            subjects,
            savedSyllabus     // Saved data EJS ko bheja
        });
    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});

// --- 2. Existing Initial GET Routes Update (No Default Class) ---

router.get("/teachers/monthly-test-syllabus", teacherAuth, async (req, res) => {
    try {
        return res.redirect(`/teachers/get-syllabus-view/monthly/null/null`);
    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});

router.get("/teachers/exams-syllabus", teacherAuth, async (req, res) => {
    try {
        return res.redirect(`/teachers/get-syllabus-view/exams/null/null`);
    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});


// --- 3. POST Route (Save Syllabus) Update ---

router.post("/teachers/save-syllabus", teacherAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;

        const { className, type, period } = req.body;

        // Frontend validation hone ke karan, yahan className aur period available honge.

        const subjectsData = [];
        for (const key in req.body) {
            if (!["className", "type", "period", "_id"].includes(key) && req.body[key]) {
                subjectsData.push({ name: key, content: req.body[key] });
            }
        }
        // Find and Update, agar already exist karta hai
        await Syllabus.findOneAndUpdate(
            { class: className, type, period, schoolCode },
            { $set: { subjects: subjectsData, createdBy: req.session.teacherId, schoolCode } },
            { upsert: true, new: true } // upsert: true - agar nahi mila toh naya bana do
        );

        // Save hone ke baad, selected class aur period ke saath wapas redirect karein
        const redirectUrl = `/teachers/get-syllabus-view/${type}/${className}/${period}`;
        return res.redirect(redirectUrl);

    } catch (error) {
        console.error("Error saving syllabus:", error);
        // Error par bhi, selected class/period ke saath wapas bhej sakte hain
        const redirectUrl = `/teachers/get-syllabus-view/${type}/${className}/${period}`;
        return res.redirect(redirectUrl);
    }
});

module.exports = router;
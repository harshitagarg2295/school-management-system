const express = require("express");
const router = express.Router();

const Student = require("../../models/StudentSchema");
const StudentResult = require("../../models/StudentResultSchema");
const AdminProfile = require("../../models/AdminProfileSchema");
const AdminNotification = require("../../models/AdminNotificationSchema");
const Timetable = require("../../models/Timetable");
const { adminAuth } = require("../../middlewares/auth");

// ─────────────────────────────────────────────────────────────
// GET /admin/documents  — Hub landing page
// ─────────────────────────────────────────────────────────────
router.get("/admin/documents", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        const admin = await AdminNotification.findOne({ schoolCode }) || { notifications: [] };
        res.render("Admin/documents_hub", { admin });
    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});

// ─────────────────────────────────────────────────────────────
// GET /admin/documents/marksheet  — Marksheet form
// ─────────────────────────────────────────────────────────────
router.get("/admin/documents/marksheet", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        const admin = await AdminNotification.findOne({ schoolCode }) || { notifications: [] };
        const allClasses = await Student.distinct("class", { schoolCode });

        const selectedClass = req.query.class || "";
        const selectedSection = req.query.section || "";
        let students = [];
        let sections = [];

        if (selectedClass) {
            sections = await Student.distinct("section", { schoolCode, class: selectedClass });
            if (selectedSection) {
                students = await Student.find({ schoolCode, class: selectedClass, section: selectedSection }).sort({ studentName: 1 });
            }
        }

        const selectedStudentId = req.query.studentId || "";
        let exams = [];
        if (selectedStudentId) {
            exams = await StudentResult.find({ schoolCode, studentId: selectedStudentId })
                .select("examType examName year")
                .sort({ year: -1, createdAt: -1 });
        }

        res.render("Admin/documents_marksheet", {
            admin,
            allClasses: allClasses.sort(),
            selectedClass,
            selectedSection,
            sections: sections.sort(),
            students,
            selectedStudentId,
            exams
        });
    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});

// ─────────────────────────────────────────────────────────────
// POST /admin/documents/marksheet/generate  — Render printable marksheet
// ─────────────────────────────────────────────────────────────
router.post("/admin/documents/marksheet/generate", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        const { studentId, resultId } = req.body;

        const student = await Student.findOne({ _id: studentId, schoolCode });
        if (!student) return res.status(404).send("Student not found");

        const result = await StudentResult.findOne({ _id: resultId, schoolCode });
        if (!result) return res.status(404).send("Result not found");

        const profile = await AdminProfile.findOne({ schoolCode });
        const schoolName = req.session.schoolName || profile?.name || "School";
        const schoolAddress = profile?.address || "";

        // Convert marks Map to plain object
        const marksObj = {};
        if (result.marks) {
            result.marks.forEach((val, key) => { marksObj[key] = val; });
        }

        res.render("pdf/marksheet_template", {
            student,
            result: { ...result.toObject(), marks: marksObj },
            schoolName,
            schoolAddress,
            generatedDate: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
        });

    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});

// ─────────────────────────────────────────────────────────────
// GET /admin/documents/admit-card  — Admit card form
// ─────────────────────────────────────────────────────────────
router.get("/admin/documents/admit-card", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        const admin = await AdminNotification.findOne({ schoolCode }) || { notifications: [] };
        const allClasses = await Student.distinct("class", { schoolCode });

        const selectedClass = req.query.class || "";
        const selectedSection = req.query.section || "";
        let students = [];
        let sections = [];

        if (selectedClass) {
            sections = await Student.distinct("section", { schoolCode, class: selectedClass });
            if (selectedSection) {
                students = await Student.find({ schoolCode, class: selectedClass, section: selectedSection }).sort({ studentName: 1 });
            }
        }

        // Fetch all timetables (both monthly & exams) for the selected class only
        const timetableQuery = { schoolCode };
        if (selectedClass) timetableQuery.class = selectedClass;
        const timetables = await Timetable.find(timetableQuery).sort({ type: 1, period: 1 });

        // If a timetable is selected via query, load its subjects
        const selectedTimetableId = req.query.timetableId || "";
        let selectedTimetable = null;
        if (selectedTimetableId) {
            selectedTimetable = await Timetable.findOne({ _id: selectedTimetableId, schoolCode });
            if (selectedTimetable && selectedTimetable.subjects) {
                selectedTimetable.subjects.sort((a, b) => new Date(a.date) - new Date(b.date));
            }
        }

        res.render("Admin/documents_admit_card", {
            admin,
            allClasses: allClasses.sort(),
            selectedClass,
            selectedSection,
            sections: sections.sort(),
            students,
            timetables,
            selectedTimetableId,
            selectedTimetable
        });
    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});

// ─────────────────────────────────────────────────────────────
// POST /admin/documents/admit-card/generate  — Render printable admit card
// ─────────────────────────────────────────────────────────────
router.post("/admin/documents/admit-card/generate", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        const { studentId, timetableId, examTime, examCenter } = req.body;

        const student = await Student.findOne({ _id: studentId, schoolCode });
        if (!student) return res.status(404).send("Student not found");

        const timetable = await Timetable.findOne({ _id: timetableId, schoolCode });
        if (!timetable) return res.status(404).send("Timetable not found");

        // Sort subjects by date
        const sortedSubjects = (timetable.subjects || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));

        const profile = await AdminProfile.findOne({ schoolCode });
        const schoolName = req.session.schoolName || profile?.name || "School";
        const schoolAddress = profile?.address || "";

        // Build schedule with unified time
        const schedule = sortedSubjects.map(s => ({
            subject: s.name,
            date: s.date,
            time: examTime || "—"
        }));

        res.render("pdf/admit_card_template", {
            student,
            examName: timetable.period,
            examYear: new Date().getFullYear(),
            examCenter: examCenter || schoolName,
            schedule,
            schoolName,
            schoolAddress,
            generatedDate: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
        });

    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});

// ─────────────────────────────────────────────────────────────
// GET /admin/documents/tc  — TC form
// ─────────────────────────────────────────────────────────────
router.get("/admin/documents/tc", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        const admin = await AdminNotification.findOne({ schoolCode }) || { notifications: [] };
        const allClasses = await Student.distinct("class", { schoolCode });

        const selectedClass = req.query.class || "";
        let students = [];
        if (selectedClass) {
            students = await Student.find({ schoolCode, class: selectedClass }).sort({ studentName: 1 });
        }

        res.render("Admin/documents_tc", {
            admin,
            allClasses: allClasses.sort(),
            selectedClass,
            students
        });
    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});

// ─────────────────────────────────────────────────────────────
// POST /admin/documents/tc/generate  — Render printable TC
// ─────────────────────────────────────────────────────────────
router.post("/admin/documents/tc/generate", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        const { studentId, tcNumber, dateOfLeaving, reasonForLeaving, conduct, lastExamPassed } = req.body;

        const student = await Student.findOne({ _id: studentId, schoolCode });
        if (!student) return res.status(404).send("Student not found");

        const profile = await AdminProfile.findOne({ schoolCode });
        const schoolName = req.session.schoolName || profile?.name || "School";
        const schoolAddress = profile?.address || "";

        res.render("pdf/tc_template", {
            student,
            tcNumber: tcNumber || "—",
            dateOfLeaving: dateOfLeaving ? new Date(dateOfLeaving).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—",
            reasonForLeaving: reasonForLeaving || "—",
            conduct: conduct || "Good",
            lastExamPassed: lastExamPassed || "—",
            schoolName,
            schoolAddress,
            generatedDate: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
        });

    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});

// ─────────────────────────────────────────────────────────────
// GET /admin/documents/bonafide  — Bonafide form
// ─────────────────────────────────────────────────────────────
router.get("/admin/documents/bonafide", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        const admin = await AdminNotification.findOne({ schoolCode }) || { notifications: [] };
        const allClasses = await Student.distinct("class", { schoolCode });

        const selectedClass = req.query.class || "";
        let students = [];
        if (selectedClass) {
            students = await Student.find({ schoolCode, class: selectedClass }).sort({ studentName: 1 });
        }

        res.render("Admin/documents_bonafide", {
            admin,
            allClasses: allClasses.sort(),
            selectedClass,
            students
        });
    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});

// ─────────────────────────────────────────────────────────────
// POST /admin/documents/bonafide/generate  — Render printable bonafide
// ─────────────────────────────────────────────────────────────
router.post("/admin/documents/bonafide/generate", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        const { studentId, purpose, certNumber } = req.body;

        const student = await Student.findOne({ _id: studentId, schoolCode });
        if (!student) return res.status(404).send("Student not found");

        const profile = await AdminProfile.findOne({ schoolCode });
        const schoolName = req.session.schoolName || profile?.name || "School";
        const schoolAddress = profile?.address || "";

        res.render("pdf/bonafide_template", {
            student,
            purpose: purpose || "general purposes",
            certNumber: certNumber || "—",
            schoolName,
            schoolAddress,
            generatedDate: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
        });

    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});

module.exports = router;

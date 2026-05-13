const express = require("express");
const router = express.Router();
const Announcement = require("../../models/Announcement");
const { studentAuth } = require("../../middlewares/auth");

router.get("/students/view-announcement", studentAuth, async (req, res) => {
    const studentClass = req.session.studentId.class;
    const schoolCode = req.session.schoolCode;
    const announcements = await Announcement.find({
        schoolCode,
        $or: [
            { class: studentClass },
            { class: "All" }
        ]
    }).sort({ date: -1 });

    res.render("Students/viewAnnouncement", { announcements, role: "student" });
});


module.exports = router;
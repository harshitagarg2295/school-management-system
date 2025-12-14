const express = require('express')
const router = express.Router()
const announcement = require("../../models/Announcement")
const Student = require("../../models/StudentSchema")
const {adminAuth, teacherAuth} =  require("../../middlewares/auth");


// This file hold add and view route of announcements for teachers and admin (both)

// Announcemt related routes for Teachers
router.get("/teachers/add-announcement",teacherAuth, async (req, res) => {
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
    res.render("Teachers/addAnnouncement", { classList, role: "teacher" });
});


// Save the form (POST request)
router.post("/teachers/add-announcement", async (req, res) => {

    const { title, description, date, class: className } = req.body;

    const teacherName = req.session.teacherName;

    await announcement.create({
        title,
        description,
        date,
        class: className || "All",
        by: "Teacher",
        teacherName: teacherName
    });
    res.redirect("/teachers/add-announcement");
})

// Teacher View Announcements
router.get("/teachers/view-announcement", teacherAuth,async (req, res) => {
    const teacherName = req.session.teacherName;

    const announcements = await announcement.find({
        $or: [
            { by: "Teacher", teacherName: teacherName },  // teacher ki apni announcements
            { by: "Principal", target: "teacher" }        // admin ki teacher ke liye wali
        ]
    }).sort({ date: -1 });

    res.render("Students/viewAnnouncement", { announcements, role: "teacher" });
});


// Announcemt related routes for Admin

router.get("/admin/add-announcement",adminAuth, async (req, res) => {
    const classList = await Student.distinct("class");
    const classOrder = [
        "Nursery", "LKG", "UKG",
        "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
        "11", "12"
    ];

    classList.sort((a, b) => {
        const idxA = classOrder.indexOf(a);
        const idxB = classOrder.indexOf(b);
        return (idxA === -1 ? Infinity : idxA) - (idxB === -1 ? Infinity : idxB);
    });

    res.render("Teachers/addAnnouncement", { classList, role: "admin" });
});


router.post("/admin/add-announcement", async (req, res) => {
    const { title, description, date, class: className } = req.body;

    let target = "student";
    let cls = className || "All";

    if (className === "Teachers") {
        target = "teacher";
        cls = null;   // teacher ke liye class ki zaroorat nahi
    }

    await announcement.create({
        title,
        description,
        date,
        class: cls,
        by: "Principal",
        teacherName: null,
        target
    });

    res.redirect("/admin/add-announcement");
});


// Admin View Announcements
router.get("/admin/view-announcement",adminAuth, async (req, res) => {
    const announcements = await announcement.find({ by: "Principal" }).sort({ date: -1 });

    res.render("Students/viewAnnouncement", { announcements, role: "admin" });
});


module.exports = router
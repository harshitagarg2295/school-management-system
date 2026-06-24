const express = require('express');
const router = express.Router();
const StudyMaterial = require("../../models/StudyMaterial");
const { studentAuth } = require("../../middlewares/auth");
const { redirectDownload, redirectPreview } = require("../../utils/streamHelper");

router.get("/students/view-study-material", studentAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        const studentClass = req.session.class || (req.session.studentId ? req.session.studentId.class : null);
        if (!studentClass) return res.redirect("/login");
        const materials = await StudyMaterial.find({ class: studentClass, schoolCode }).sort({ uploadedAt: -1 });
        res.render("Students/studentViewMaterial", { materials, studentClass });
    } catch (error) {
        console.error("Error fetching student materials:", error);
        res.status(500).send("Internal Server Error");
    }
});

// ✅ DOWNLOAD
router.get("/students/download-material/:id", studentAuth, async (req, res) => {
    try {
        const material = await StudyMaterial.findById(req.params.id);
        if (!material || !material.fileUrl) return res.redirect("/students/view-study-material");
        redirectDownload(material.fileUrl, res, "/students/view-study-material");
    } catch (err) {
        console.error("Student Download Error:", err);
        res.redirect("/students/view-study-material");
    }
});

// ✅ PREVIEW
router.get("/students/preview-material/:id", studentAuth, async (req, res) => {
    try {
        const material = await StudyMaterial.findById(req.params.id);
        if (!material || !material.fileUrl) return res.redirect("/students/view-study-material");
        redirectPreview(material.fileUrl, res, "/students/view-study-material");
    } catch (err) {
        console.error("Preview Error:", err);
        res.redirect("/students/view-study-material");
    }
});

module.exports = router;
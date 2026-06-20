const express = require('express');
const router = express.Router();
const StudyMaterial = require("../../models/StudyMaterial");
const { studentAuth } = require("../../middlewares/auth");
const { cloudinary } = require("../../config/cloudinaryConfig");

router.get("/students/view-study-material", studentAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        
        // Safe check: Aapke session architecture ke hisab se class fetch karna
        const studentClass = req.session.class || (req.session.studentId ? req.session.studentId.class : null);

        if (!studentClass) {
            console.log("Student class not found in session");
            return res.redirect("/login");
        }

        // Only fetch material of that class and school
        const materials = await StudyMaterial.find({ class: studentClass, schoolCode }).sort({ uploadedAt: -1 });

        res.render("Students/studentViewMaterial", {
            materials: materials,
            studentClass: studentClass,
        });
        
    } catch (error) {
        console.error("Error fetching student materials:", error);
        res.status(500).send("Internal Server Error");
    }
});

// ✅ Student Download Route — works for all file types
router.get("/students/download-material/:id", studentAuth, async (req, res) => {
    try {
        const material = await StudyMaterial.findById(req.params.id);
        if (!material || !material.fileUrl) {
            return res.redirect("/students/view-study-material");
        }

        const fileUrl = material.fileUrl;
        const publicId = material.publicId;

        const isImage = fileUrl.includes('/image/upload/') ||
            /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileUrl);

        if (isImage) {
            const downloadUrl = cloudinary.url(publicId, {
                resource_type: 'image',
                flags: 'attachment',
                secure: true,
                sign_url: true,
                type: 'upload'
            });
            return res.redirect(downloadUrl);
        } else {
            // IMPORTANT: publicId in DB may NOT include file extension,
            // so cloudinary.url(publicId) would generate a URL that 404s.
            // Inject fl_attachment directly into the stored fileUrl instead.
            let downloadUrl = fileUrl;
            if (fileUrl.includes('/upload/')) {
                downloadUrl = fileUrl.replace('/upload/', '/upload/fl_attachment/');
            }
            return res.redirect(downloadUrl);
        }
    } catch (err) {
        console.error("Student Download Error:", err);
        return res.redirect("/students/view-study-material");
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const StudyMaterial = require("../../models/StudyMaterial");
const { studentAuth } = require("../../middlewares/auth");

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

module.exports = router;
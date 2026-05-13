const express = require('express');
const router = express.Router();
const StudyMaterial = require("../../models/StudyMaterial")
const { studentAuth } = require("../../middlewares/auth");

router.get("/students/view-study-material", studentAuth, async (req, res) => {
    const schoolCode = req.session.schoolCode;
    const studentClass = req.session.studentId.class

    if (!studentClass) {
        return res.redirect("/login");
    }

    // केवल उस Class के लिए Material Fetch करें

    const materials = await StudyMaterial.find({ class: studentClass, schoolCode }).sort({ uploadedAt: -1 }); // नए अपलोड किए गए मटेरियल को पहले दिखाएं

    res.render("Students/studentViewMaterial", {
        materials: materials,
        studentClass: studentClass,
        // अन्य आवश्यक variables, जैसे studentName, आदि
    });

})

module.exports = router

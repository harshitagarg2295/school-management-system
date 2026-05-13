const express = require('express');
const router = express.Router();
const { studentAuth } = require("../../middlewares/auth");

router.get("/students/profile", studentAuth, async (req, res) => {
  try {
    const schoolCode = req.session.schoolCode;
    const Student = req.app.get("Student");

    // 🔥 FIX: Check karo studentId object hai ya string
    let sId = req.session.studentId;
    if (typeof sId === 'object' && sId.id) {
        sId = sId.id; // Agar object hai toh uski id nikaal lo
    }

    const student = await Student.findOne({
      _id: sId, // Ab ye sahi string jayegi
      schoolCode
    });

    if (!student) {
      return res.redirect("/login");
    }

    res.render("Students/studentProfile", { student });

  } catch (err) {
    console.log("Profile Error:", err);
    res.status(500).send("Error loading profile");
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const { teacherAuth } = require("../../middlewares/auth");

router.get("/teachers/profile", teacherAuth, async (req, res) => {
  try {
    const schoolCode = req.session.schoolCode;
    const Teacher = req.app.get("Teacher");

    const teacher = await Teacher.findOne({
      _id: req.session.teacherId,
      schoolCode
    });

    if (!teacher) {
      return res.redirect("/login");
    }

    res.render("Teachers/teacherProfile", { teacher });

  } catch (err) {
    console.log(err);
    res.send("Error loading profile");
  }
});

module.exports = router;
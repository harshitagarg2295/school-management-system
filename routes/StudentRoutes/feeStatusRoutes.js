const express = require("express");
const router = express.Router();
const Student = require("../../models/StudentSchema");
const {studentAuth} =  require("../../middlewares/auth");

// Student Fee Status Page
router.get("/students/fees-status",studentAuth, async (req, res) => {
  try {

    if (!req.session.studentId || !req.session.studentId.id) {
      return res.redirect("/student.html");
    }

    const student = await Student.findById(req.session.studentId.id);

    if (!student) {
      return res.status(404).send("Student not found");
    }

    res.render("feeStatus", { student });
  } catch (err) {
    console.error("Error fetching student fee status:", err);
    res.status(500).send("Server Error");
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const Student = require("../../models/StudentSchema");
const { studentAuth } = require("../../middlewares/auth");

// GET - Student Fees Status Page

router.get("/students/fees-status", studentAuth, async (req, res) => {

  const schoolCode = req.session.schoolCode;
  const studentId = req.session.studentId?.id;

  try {
    if (!studentId) {
      return res.redirect("/login");
    }

    const student = await Student.findOne({
      _id: studentId,
      schoolCode
    });

    if (!student) {
      return res.status(404).send("Student not found");
    }
    res.render("Students/feeStatus", { student });
  }

  catch (err) {
    console.error("Error fetching student fee status:", err);
    res.status(500).send("Server Error");
  }
}
);

module.exports = router;
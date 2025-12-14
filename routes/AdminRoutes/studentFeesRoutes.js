const express = require("express");
const router = express.Router();
const Student = require("../../models/StudentSchema");
const { adminAuth } =  require("../../middlewares/auth");


router.get("/fee-status/:id", adminAuth , async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    res.render("Admin/students_fees_page", { student });
  } catch (err) {
    res.status(500).send("Student not found");
  }

});

router.post("/update-fee-status/:studentId", async (req, res) => {
  const { studentId } = req.params;
  const feeStatus = req.body.feeStatus;

  const student = await Student.findById(studentId);
  if (!student || !feeStatus) return res.send("Invalid data");

  student.feeStatus.forEach((fee, index) => {
    if (feeStatus[index]) {


      const input = feeStatus[index];
      if (input) {
        // ✅ हमेशा status update करो
        fee.status = input.status;

        // ✅ सिर्फ़ तब date save करो जब user ने कोई date चुनी हो
        if (input.paymentDate && input.paymentDate.trim() !== "") {
          fee.paymentDate = input.paymentDate;
        }

        // ✅ mode तभी बदले जब:
        //    1. status "Paid" हो  AND
        //    2. user ने mode explicitly दिया हो
        if (input.status === "Paid" && input.mode && input.mode.trim() !== "") {
          fee.mode = input.mode;
        }
      }
    }
  });


  await student.save();
  res.redirect("/fee-status/" + studentId);
});

module.exports = router;

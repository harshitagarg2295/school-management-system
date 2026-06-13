const express = require("express");
const router = express.Router();
const Student = require("../../models/StudentSchema");
const { adminAuth } = require("../../middlewares/auth");


router.get("/fee-status/:id", adminAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  try {
    const student = await Student.findOne({
      _id: req.params.id,
      schoolCode
    });
    res.render("Admin/students_fees_page", { student });
  } catch (err) {
    console.error(err);
    return res.status(500).render("HomePage/500");
  }

});

router.post("/update-fee-status/:studentId", adminAuth, async (req, res) => {
  try {
    const schoolCode = req.session.schoolCode;

    const { studentId } = req.params;
    const feeStatus = req.body.feeStatus;

    const student = await Student.findOne({
      _id: studentId,
      schoolCode
    });
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
  } catch (err) {
    console.error(err);
    return res.status(500).render("HomePage/500");
  }
});


// ✅ Vehicle Fee Status Update Route
router.post("/update-vehicle-fee-status/:studentId", adminAuth, async (req, res) => {
  try {
    const schoolCode = req.session.schoolCode;
    const { studentId } = req.params;
    const vehicleFeeStatus = req.body.vehicleFeeStatus;

    const student = await Student.findOne({ _id: studentId, schoolCode });
    if (!student || !vehicleFeeStatus) return res.send("Invalid data");

    student.vehicleFeeStatus.forEach((fee, index) => {
      const input = vehicleFeeStatus[index];
      if (input) {
        // ✅ Status hamesha update karo
        fee.status = input.status;

        // ✅ Date sirf tab save karo jab user ne select ki ho
        if (input.paymentDate && input.paymentDate.trim() !== "") {
          fee.paymentDate = new Date(input.paymentDate);
        }

        // ✅ Mode sirf Paid pe save karo
        if ((input.status === "Paid") && input.mode && input.mode.trim() !== "") {
          fee.mode = input.mode;
        }
      }
    });

    await student.save();
    res.redirect("/fee-status/" + studentId);
  } catch (err) {
    console.error("Vehicle fee update error:", err);
    return res.status(500).render("HomePage/500");
  }
});

module.exports =  router;

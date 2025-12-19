const express = require("express");
const router = express.Router();
const Student = require("../../models/StudentSchema");
const {studentAuth} =  require("../../middlewares/auth");

router.get("/students/checkout-fees",studentAuth, async (req, res) => {
    const studentId = req.session.studentId.id;
    if (!studentId) return res.redirect("/student.html");

    const student = await Student.findById(studentId);
    res.render("Students/checkOutFees", { student });
});


// POST - Pay selected installments
router.post("/students/checkout-fees", studentAuth,async (req, res) => {
    try {
        const { studentId } = req.body;
        let selectedIndexes = req.body.installments;

        if (!Array.isArray(selectedIndexes)) {
            selectedIndexes = [selectedIndexes];
        }

        const student = await Student.findById(studentId);
        if (!student) return res.send("Student not found");

        res.render("Students/paymentOptions", {
            student,
            selectedIndexes,
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Something went wrong");
    }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const Student = require("../../models/StudentSchema");
const { studentAuth } = require("../../middlewares/auth");

router.get("/students/checkout-fees", studentAuth, async (req, res) => {
    const schoolCode = req.session.schoolCode;
    const studentId = req.session.studentId.id;
    if (!studentId) return res.redirect("/login");

    const student = await Student.findOne({
        _id: studentId,
        schoolCode
    });
    res.render("Students/checkOutFees", {
        student,
    });
});


// POST - Pay selected installments
router.post("/students/checkout-fees", studentAuth, async (req, res) => {
    const schoolCode = req.session.schoolCode;
    try {
        const studentId = req.session.studentId.id;
        let selectedIndexes = req.body.installments;

        if (!Array.isArray(selectedIndexes)) {
            selectedIndexes = [selectedIndexes];
        }

        const student = await Student.findOne({
            _id: studentId,
            schoolCode
        });
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

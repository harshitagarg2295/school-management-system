const express = require("express");
const router = express.Router();
const Student = require("../../models/StudentSchema");
const AdminProfile = require("../../models/AdminProfileSchema");
const { studentAuth } = require("../../middlewares/auth");


// GET - Checkout Fees Page

router.get("/students/checkout-fees", studentAuth, async (req, res) => {

    const schoolCode = req.session.schoolCode;
    const studentId = req.session.studentId.id;

    if (!studentId) {
        return res.redirect("/login");
    }

    try {
        const student = await Student.findOne({
            _id: studentId,
            schoolCode
        });

        if (!student) {
            return res.status(404).send("Student not found");
        }

        const schoolName = req.session.schoolName || student.schoolName || "School";

        res.render("Students/checkOutFees", {
            student,
            schoolName
        });

    }

    catch (err) {
        console.error("Checkout fees page error:", err);
        res.status(500).send("Server Error");
    }
});

// POST - Selected Installments

router.post("/students/checkout-fees", studentAuth, async (req, res) => {

    const schoolCode = req.session.schoolCode;

    try {
        const studentId = req.session.studentId.id;

        let selectedIndexes = req.body.installments;
        // Agar koi installment select nahi ki

        if (!selectedIndexes || selectedIndexes.length === 0
        ) {
            return res.send(`
                <script>
                    alert("Please select at least one installment.");
                    window.location.href = "/students/checkout-fees";
                </script>
            `);
        }

        // Single checkbox ko array me convert karna

        if (!Array.isArray(selectedIndexes)) {
            selectedIndexes = [selectedIndexes];
        }

        const student = await Student.findOne({
            _id: studentId,
            schoolCode
        });

        if (!student) {
            return res.status(404).send("Student not found");
        }

        const admin = await AdminProfile.findOne({
            schoolCode
        });

        const schoolName = req.session.schoolName || student.schoolName || "School";

        // Razorpay account check

        if (!admin?.schoolAccountId) {

            return res.send(`
                <script>
                    alert( "School payment account is not configured yet.");
                    window.location.href = "/students/checkout-fees";
                </script>
            `);
        }

        res.render("Students/paymentOptions", {
            student,
            selectedIndexes,
            schoolName,
            schoolAccountId: admin.schoolAccountId
        });

    }

    catch (err) {
        console.error("Checkout fees post error:", err);
        res.status(500).send("Something went wrong");
    }
});

module.exports = router;
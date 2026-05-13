const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay"); // for payment integration
const Student = require("../../models/StudentSchema");
const AdminNotificationSchema = require("../../models/AdminNotificationSchema");
const { studentAuth, adminAuth } = require("../../middlewares/auth");

const razorpay = new Razorpay({
  key_id: "rzp_test_RSEpP4AhOamoYZ",
  key_secret: "CjokTFt2u55BXW24hmB585ka",
});

// ✅ Create Order Route
router.post("/create-order", studentAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  const { amount } = req.body;

  try {
    if (!amount || amount < 1) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const options = {
      amount: Math.round(amount * 100), // Convert ₹ to paise
      currency: "INR",
      receipt: "receipt_" + Math.floor(Math.random() * 10000),
    };

    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (err) {
    console.error("Razorpay order error:", err);
    res.status(500).send("Error creating order");
  }
});

// ✅ Payment Success Route
router.get("/payment-success", studentAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  try {
    const studentId = req.session.studentId.id;
    const student = await Student.findOne({
      _id: studentId,
      schoolCode
    });
    const { payment_id, amount, installments } = req.query;
    const parsedInstallments = JSON.parse(decodeURIComponent(installments));

    // Optional: Mark installments as paid in DB
    parsedInstallments.forEach(i => {
      if (student.feeStatus[i.index]) {
        student.feeStatus[i.index].status = "Paid";
        student.feeStatus[i.index].paymentId = payment_id;
        student.feeStatus[i.index].paymentDate = new Date();
        student.feeStatus[i.index].mode = "Online";
      }
    });

    await student.save();

    let admin = await AdminNotificationSchema.findOne({ schoolCode });

    if (!admin) {
      // DB me admin document nahi hai, create kar do
      admin = new AdminNotificationSchema({ notifications: [], schoolCode });
    }

    // Notification add karo
    admin.notifications.unshift({
      message: `Payment Received: ₹${amount} from ${student.name} class ${student.class}${student.section} (${student.id}) for installments: ${parsedInstallments.map(i => i.installment).join(", ")}.`
    });

    // Save karo
    await admin.save();


    res.render("Students/paymentStatus", {
      success: true,
      amount,
      orderId: payment_id,
      student,
      installments: parsedInstallments,
      admin,
    });

  } catch (err) {
    console.error("Payment success route error:", err);
    res.render("Students/paymentStatus", { success: false });
  }
});

// ✅ Failure Route
router.get("/payment-failure", studentAuth, (req, res) => {
  res.render("Students/paymentStatus", { success: false });
});


// This mark all notifications as read

router.post("/mark-notifications-read", adminAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  try {
    const admin = await AdminNotificationSchema.findOne({ schoolCode });
    if (admin) {
      admin.notifications.forEach(n => n.read = true);
      await admin.save();
    }
    res.status(200).send("Notifications marked as read");
  } catch (err) {
    console.error("Error marking notifications as read:", err);
    res.status(500).send("Server error");
  }
});

// Sare notifications delete karne ke liye
router.post("/clear-all-notifications", adminAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  try {
    await AdminNotificationSchema.findOneAndUpdate(
      { schoolCode },
      { $set: { notifications: [] } } // Array ko khali kar do
    );
    res.status(200).send("Cleared");
  } catch (err) {
    res.status(500).send("Error");
  }
});


module.exports = router;

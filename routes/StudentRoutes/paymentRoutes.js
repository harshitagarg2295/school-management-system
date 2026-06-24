
const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Student = require("../../models/StudentSchema");
const AdminProfile = require("../../models/AdminProfileSchema");
const AdminNotificationSchema = require("../../models/AdminNotificationSchema");
const { studentAuth } = require("../../middlewares/auth");

function getRazorpayInstance(mode) {
  return new Razorpay({
    key_id: mode === "live" ? process.env.RAZORPAY_LIVE_KEY_ID : process.env.RAZORPAY_TEST_KEY_ID,
    key_secret: mode === "live" ? process.env.RAZORPAY_LIVE_KEY_SECRET : process.env.RAZORPAY_TEST_KEY_SECRET
  });
}

function getMode(schoolCode) {
  return schoolCode === "DEMO248" ? "test" : "live";
}

async function updateStudentPayment({ student, parsedInstallments, paymentId, schoolCode }) {

  parsedInstallments.forEach(i => {
    if (i.type === "vehicle") {
      // ✅ Vehicle fees update
      if (!student.vehicleFeeStatus || !student.vehicleFeeStatus[i.index]) return;
      if (student.vehicleFeeStatus[i.index].status === "Paid") return;
      student.vehicleFeeStatus[i.index].status = "Paid";
      student.vehicleFeeStatus[i.index].paymentId = paymentId;
      student.vehicleFeeStatus[i.index].paymentDate = new Date();
      student.vehicleFeeStatus[i.index].mode = "Online";
    } else {
      // ✅ Academic fees update
      if (!student.feeStatus[i.index]) return;
      if (student.feeStatus[i.index].status === "Paid") return;
      student.feeStatus[i.index].status = "Paid";
      student.feeStatus[i.index].paymentId = paymentId;
      student.feeStatus[i.index].paymentDate = new Date();
      student.feeStatus[i.index].mode = "Online";
    }

  });

  await student.save();

  let adminNotify = await AdminNotificationSchema.findOne({ schoolCode });

  if (!adminNotify) {
    adminNotify = new AdminNotificationSchema({ notifications: [], schoolCode });
  }

  const totalPaidAmount = parsedInstallments.reduce((sum, i) => {
    if (i.type === "vehicle") {
      const fee = student.vehicleFeeStatus?.[i.index];
      return fee ? sum + fee.amount : sum;
    } else {
      const fee = student.feeStatus[i.index];
      return fee ? sum + fee.amount : sum;
    }
  }, 0);


  adminNotify.notifications.unshift({ message: `Payment Received: ₹${totalPaidAmount} from ${student.studentName} (Class: ${student.class}).` });

  await adminNotify.save();
}

//  POST Route: For generating razorpay id
router.post("/create-order", studentAuth, async (req, res) => {

  const { installments, schoolAccountId } = req.body;

  if (!installments || !schoolAccountId) {
    return res.status(400).json({
      error: "Invalid payment request."
    });
  }

  try {
    const studentId = req.session.studentId.id;
    const schoolCode = req.session.schoolCode;

    const razorpay = getRazorpayInstance(getMode(schoolCode));

    const student = await Student.findOne({
      _id: studentId,
      schoolCode
    });

    if (!student) {
      return res.status(404).json({
        error: "Student not found."
      });
    }

    // Backend amount calculation

    let schoolBaseFee = 0;

    installments.forEach(i => {

      if (typeof i.index === "undefined" || i.index === null) return;

      if (i.type === "vehicle") {
        // ✅ Vehicle fee
        const fee = student.vehicleFeeStatus?.[parseInt(i.index)];
        if (fee && fee.status !== "Paid") schoolBaseFee += fee.amount;
      } else {
        // ✅ Academic fee
        const fee = student.feeStatus[parseInt(i.index)];
        if (fee && fee.status !== "Paid") schoolBaseFee += fee.amount;
      }

    });

    if (schoolBaseFee <= 0) {
      return res.status(400).json({ error: "Invalid fee amount. All selected fees may already be paid." });
    }

    const schoolShareInPaise = Math.round(schoolBaseFee * 100);

    const calculatedPortalFee = parseFloat((schoolBaseFee * 0.002).toFixed(2)); //0.2% portal fee
    const portalFeeInPaise = Math.round(calculatedPortalFee * 100);

    const totalAmountInPaise = schoolShareInPaise + portalFeeInPaise;

    const options = {
      amount: totalAmountInPaise,
      currency: "INR",
      receipt: "rcpt_" + Math.floor(100000 + Math.random() * 900000),
      notes: {
        studentId,
        schoolCode,
        installments: JSON.stringify(installments)
      },

       ...(schoolAccountId && schoolAccountId.startsWith("acc_") && getMode(schoolCode) === "live" ? {

        transfers: [
          {
            account: schoolAccountId,
            amount: schoolShareInPaise,
            currency: "INR",
            on_hold: false
          }
        ]
     } : {})
    };


    const order = await razorpay.orders.create(options);
    const mode = getMode(schoolCode);
    res.json({ ...order, razorpayKey: mode === "live" ? process.env.RAZORPAY_LIVE_KEY_ID : process.env.RAZORPAY_TEST_KEY_ID });
  }
  catch (err) {
    // ✅ Better error logging for debugging
    console.error("Order creation error details:", JSON.stringify(err?.error || err?.message || err, null, 2));
    res.status(500).json({ error: "Order generation failed", detail: err?.error?.description || err?.message });
  }
});

// 3. POST Route: Verify the payment and update it in DB
router.post("/verify-payment", studentAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, installments } = req.body;

  try {

    const razorpaySecret = getMode(schoolCode) === "live" ? process.env.RAZORPAY_LIVE_KEY_SECRET : process.env.RAZORPAY_TEST_KEY_SECRET;

    const hmac = crypto.createHmac("sha256", razorpaySecret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Signature verification failed."
      });
    }

    const razorpay = getRazorpayInstance(getMode(schoolCode));

    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (payment.status !== "captured") {

      return res.status(400).json({
        success: false,
        message: "Payment not captured."
      });
    }

    const studentId = req.session.studentId.id;

    const student = await Student.findOne({ _id: studentId, schoolCode });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found."
      });
    }

    const parsedInstallments = typeof installments === "string" ? JSON.parse(installments) : installments;

    // ✅ Expected amount check — academic + vehicle fees both
    const expectedAmount = parsedInstallments.reduce((sum, i) => {
      if (i.type === "vehicle") {
        const fee = student.vehicleFeeStatus?.[parseInt(i.index)];
        return (fee && fee.status !== "Paid") ? sum + fee.amount : sum;
      } else {
        const fee = student.feeStatus[parseInt(i.index)];
        return (fee && fee.status !== "Paid") ? sum + fee.amount : sum;
      }
    }, 0);

    // ✅ Duplicate payment check — academic + vehicle dono handle karo
    const alreadyPaid = parsedInstallments.every(i => {
      if (i.type === "vehicle") {
        return student.vehicleFeeStatus?.[i.index]?.status === "Paid";
      }
      return student.feeStatus[i.index]?.status === "Paid";
    });
    if (alreadyPaid) {
      return res.json({ success: true, alreadyProcessed: true });
    }

    const calculatedPortalFee = parseFloat((expectedAmount * 0.002).toFixed(2));

    const expectedAmountInPaise = Math.round((expectedAmount + calculatedPortalFee) * 100);

    if (payment.amount !== expectedAmountInPaise) {

      return res.status(400).json({
        success: false,
        message: "Payment amount mismatch."
      });
    }

    await updateStudentPayment({
      student,
      parsedInstallments,
      paymentId: razorpay_payment_id,
      schoolCode
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Verification Error:", err);
    res.status(500).json({ success: false, message: "Internal Verification Error" });
  }
});

router.post("/razorpay-webhook", express.raw({ type: "application/json" }), async (req, res) => {

  try {
    const webhookSignature = req.headers["x-razorpay-signature"];

    const payload = JSON.parse(req.body.toString());

    const schoolCode = payload.payload.payment.entity.notes.schoolCode;

    const webhookSecret = getMode(schoolCode) === "live" ? process.env.RAZORPAY_LIVE_WEBHOOK_SECRET : process.env.RAZORPAY_TEST_WEBHOOK_SECRET;

    const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(req.body).digest("hex");

    // Signature verification

    if (webhookSignature !== expectedSignature) {
      return res
        .status(400)
        .send("Invalid webhook signature");
    }

    // Event type

    const event = payload.event;

    // Only payment captured

    if (event === "payment.captured") {
      console.log("Webhook payment captured received");

      // Payment entity

      const payment = payload.payload.payment.entity;

      console.log("Payment ID:", payment.id);

      // DB update logic yaha aayega

      const studentId = payment.notes.studentId;
      const schoolCode = payment.notes.schoolCode;
      const parsedInstallments = JSON.parse(payment.notes.installments);
      const student = await Student.findOne({ _id: studentId, schoolCode });

      if (!student) {
        return res
          .status(404)
          .send("Student not found");
      }

      // Duplicate payment check — academic + vehicle dono handle karo

      const alreadyPaid = parsedInstallments.every(i => {
        if (i.type === "vehicle") {
          return student.vehicleFeeStatus?.[i.index]?.status === "Paid";
        }
        return student.feeStatus[i.index]?.status === "Paid";
      });


      if (alreadyPaid) {
        return res
          .status(200)
          .send("Already processed");
      }

      await updateStudentPayment({
        student,
        parsedInstallments,
        paymentId: payment.id,
        schoolCode
      });
    }

    res.status(200).send("OK");
  }

  catch (err) {
    console.error("Webhook error:", err);
    res
      .status(500)
      .send("Webhook failed");
  }
}
);

router.get("/payment-status", studentAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  const { status, payment_id, order_id, amount, installments, message } = req.query;

  if (status !== "success") {
    return res.render("Students/paymentStatus", {
      success: false,
      message: message || "Something went wrong. Please try again."
    });
  }

  try {
    const studentId = req.session.studentId.id;
    const student = await Student.findOne({ _id: studentId, schoolCode });

    let parsedInstallments = [];
    if (installments) {
      try {
        parsedInstallments = JSON.parse(decodeURIComponent(installments));
      } catch (e) {
        parsedInstallments = [];
      }
    }

    res.render("Students/paymentStatus", {
      success: true,
      amount: parseFloat(amount || 0),
      orderId: order_id || "-",
      paymentId: payment_id || "-",
      student: student || { name: "-", studentId: "-", class: "-" },
      schoolName: req.session.schoolName || "School Fee Receipt",
      installments: parsedInstallments
    });
  } catch (err) {
    console.error("Error rendering receipt page:", err);
    res.status(500).send("Error loading receipt screen");
  }
});

module.exports = router;
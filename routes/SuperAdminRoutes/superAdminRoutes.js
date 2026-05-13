const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const School = require("../../models/AllSchools");
const SuperAdmin = require("../../models/SuperAdmin");
const AdminProfile = require("../../models/AdminProfileSchema");
const { superAdminAuth } = require("../../middlewares/auth");
const Transaction = require('../../models/Transaction');


// 💰 Pricing Configuration (Yahan values change kar lena baad mein)
const pricing = {
  "monthly": 500,
  "quarterly": 1400,
  "half-yearly": 2500,
  "annually": 4500
};

// GET: login page
router.get("/super-admin/login", (req, res) => {
  res.render("superAdmin/login", { error: null });
});

// POST: login
router.post("/super-admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await SuperAdmin.findOne({ username });

    if (!admin) {
      return res.render("superAdmin/login", {
        error: "Account not found. Please check your username."
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.render("superAdmin/login", {
        error: "Invalid password. Access denied."
      });
    }

    // ✅ Fix: Purana session clear karke naya banao (Best Practice)
    req.session.regenerate((err) => {
      if (err) {
        console.log("Session Regen Error:", err);
        return res.render("superAdmin/login", { error: "Session Error" });
      }

      // Naya data set karo
      req.session.superAdminId = admin._id;

      // ✅ Fix: Save hone ka wait karo phir redirect karo
      req.session.save((saveErr) => {
        if (saveErr) {
          console.log("Session Save Error:", saveErr);
          return res.render("superAdmin/login", { error: "Save Error" });
        }
        res.redirect("/super-admin/dashboard");
      });
    });

  } catch (err) {
    console.log("Login Error:", err);
    res.render("superAdmin/login", {
      error: "Internal Server Error. Please try again later."
    });
  }
});

// logout route
router.get("/super-admin/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.log(err);
    res.redirect("/login");
  });
});

// dashboard page
router.get("/super-admin/dashboard", superAdminAuth, async (req, res) => {
  try {
    const recentSchools = await School.find()
      .sort({ createdAt: -1 })
      .limit(5);

    // 🔥 Recent Transactions
    const recentTransactions = await Transaction.find().sort({ paymentDate: -1 }).limit(5);

    const allTransactions = await Transaction.find();
    const total = await School.countDocuments();

    // Inactive: Jo manual disable kiye gaye hain
    const inactive = await School.countDocuments({ status: 'Inactive' });

    // Active: Jo inactive nahi hain AUR jinki expiry abhi baki hai
    const active = await School.countDocuments({
      status: { $ne: 'Inactive' },
      subscriptionEnd: { $gt: new Date() }
    });

    // Expired: Jo inactive nahi hain lekin expiry nikal gayi hai
    const expired = total - active - inactive;

    // Revenue Calculation
    const totalRevenue = allTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);


    // For monthly revenue data
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyTransactions = await Transaction.find({
      paymentDate: { $gte: startOfMonth }
    });

    const monthlyRevenue = monthlyTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    res.render("SuperAdmin/dashboard", {
      total,
      active,
      expired,
      inactive,
      totalRevenue,
      schools: recentSchools,
      transactions: recentTransactions,
      monthlyRevenue: monthlyRevenue
    });

  } catch (err) {
    console.log(err);
    res.send("Error loading dashboard");
  }
});

// Add school form
router.get("/super-admin/add-school", superAdminAuth, (req, res) => {
  res.render("SuperAdmin/addSchool");
});


// POST: add school
router.post("/super-admin/add-school", superAdminAuth, async (req, res) => {
  try {
    const { schoolName, adminUsername, adminPassword, plan } = req.body;

    // 1. Sabse pehle unique check karo (Warna mehnat bekar jayegi)
    const existing = await AdminProfile.findOne({ username: adminUsername });
    if (existing) {
      return res.send("Admin already exists");
    }

    // Subscription Plan logic
    let daysToAdd = 30;
    if (plan === "quarterly") daysToAdd = 90;
    else if (plan === "half-yearly") daysToAdd = 180;
    else if (plan === "annually") daysToAdd = 365;

    const subscriptionEnd = new Date();
    subscriptionEnd.setDate(subscriptionEnd.getDate() + daysToAdd);

    const cleanName = schoolName.replace(/\s+/g, '').toUpperCase();
    const schoolCode = cleanName.substring(0, 4) + Math.floor(100 + Math.random() * 900);
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // 2. PEHLE SCHOOL SAVE KARO
    const newSchool = new School({
      name: schoolName,
      code: schoolCode,
      adminUsername,
      adminPassword: hashedPassword,
      subscriptionEnd: subscriptionEnd,
      planType: plan
    });

    const savedSchool = await newSchool.save();

    // 3. AB TRANSACTION CREATE KARO (SavedSchool use karke)
    const firstTransaction = new Transaction({
      schoolId: savedSchool._id,
      schoolName: savedSchool.name,
      plan: plan,
      amount: pricing[plan] || 0,
      expiryDateAtThatTime: subscriptionEnd
    });

    await firstTransaction.save();

    // 4. Create Admin Profile
    await AdminProfile.create({
      username: adminUsername,
      password: hashedPassword,
      schoolCode: schoolCode,
      name: schoolName
    });

    res.send(`School Created! Code: ${schoolCode}`);

  } catch (err) {
    console.log(err);
    res.send("Error creating school");
  }
});

// all schools list
router.get("/super-admin/schools", superAdminAuth, async (req, res) => {
  const schools = await School.find();
  res.render("SuperAdmin/schoolsList", { schools });
});


// POST: Renew School Subscription (Jio Logic + Transaction History)
router.post("/super-admin/renew-school/:id", superAdminAuth, async (req, res) => {
  try {
    const { plan } = req.body;
    const school = await School.findById(req.params.id);

    if (!school) return res.status(404).send("School not found");

    // 1. Plan ke hisab se days calculate karna
    let daysToAdd = 30;
    if (plan === "quarterly") daysToAdd = 90;
    else if (plan === "half-yearly") daysToAdd = 180;
    else if (plan === "annually") daysToAdd = 365;

    // 🔥 JIO LOGIC
    let baseDate = (school.subscriptionEnd && school.subscriptionEnd > new Date())
      ? school.subscriptionEnd
      : new Date();

    const newExpiry = new Date(baseDate);
    newExpiry.setDate(newExpiry.getDate() + daysToAdd);

    // 2. Transaction Record Create Karo (Pricing object se amount uthayega)
    const transaction = new Transaction({
      schoolId: school._id,
      schoolName: school.name,
      plan: plan,
      amount: pricing[plan] || 0, // Jo plan select hoga uska rate yahan se aayega
      expiryDateAtThatTime: newExpiry
    });

    // 3. School Update aur Transaction Save
    school.subscriptionEnd = newExpiry;
    school.planType = plan;

    await school.save();
    await transaction.save();

    res.send("Subscription Renewed Successfully!");

  } catch (err) {
    console.error(err);
    res.status(500).send("Error renewing subscription");
  }
});

// Route: Toggle Status
router.post('/super-admin/toggle-status/:id', superAdminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    await School.findByIdAndUpdate(req.params.id, { status: status });
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send("Error updating status");
  }
});

// Route: Delete School
router.delete('/super-admin/delete-school/:id', superAdminAuth, async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    if (!school) {
      return res.status(404).send("School not found");
    }

    const sCode = school.code;

    // 2. AdminProfileSchema mein se delete karo (Using schoolCode)
    await AdminProfile.findOneAndDelete({ schoolCode: sCode });

    // 3. Transaction history b saaf karni h toh ye line add kr do (Optional but recommended)
    await Transaction.deleteMany({ schoolId: req.params.id });

    // 4. Finally, School model se delete karo
    await School.findByIdAndDelete(req.params.id);

    res.sendStatus(200);
  } catch (err) {
    res.status(500).send("Error deleting school");
  }
});

// Transaction history of each school
router.get("/super-admin/transaction-history/:id", superAdminAuth, async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    // Us school ki saari transactions nikaalo (Latest pehle)
    const history = await Transaction.find({ schoolId: req.params.id }).sort({ paymentDate: -1 });

    res.render("SuperAdmin/transaction-history", {
      school,
      history
    });
  } catch (err) {
    console.log(err);
    res.send("Error loading history");
  }
});

// 1.Super admin setting page
router.get("/super-admin/settings", superAdminAuth, async (req, res) => {
  // Check if logged in (middleware use karein yahan)
  res.render("superAdmin/superAdminSetting", { error: null, success: null });
});

// 2. Password Update Karein
router.post("/super-admin/update-password", superAdminAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Aapne jo username create kiya tha "harshitagarg"
    const admin = await SuperAdmin.findOne({ username: "harshitagarg" });

    // 1. Purana password check karein
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.render("superAdmin/superAdminSetting", {
        error: "Invalid Current Password",
        success: null
      });
    }

    // 2. Naye password ko hash karein
    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    // 3. Database mein update karein
    admin.password = hashedNewPassword;
    await admin.save();

    res.render("superAdmin/superAdminSetting", {
      error: null,
      success: "Password Updated successfully ✅"
    });

  } catch (err) {
    console.log(err);
    res.render("superAdmin/superAdminSetting", {
      error: "Something went wrong. Try Again",
      success: null
    });
  }
});

module.exports = router;

const express = require('express')
const router = express.Router();

const Admin = require("../models/AdminProfileSchema")
const Teacher = require("../models/TeacherSchema")
const Student = require("../models/StudentSchema")
const bcrypt = require("bcrypt");

const anyAuth = (req, res, next) => {
    if (
        (req.session.adminId || req.session.teacherId || req.session.studentId) &&
        req.session.schoolCode
    ) {
        return next();
    }
    return res.redirect("/");
};

router.get("/setting", anyAuth, async (req, res) => {
const schoolCode = req.session.schoolCode;
    let userType = "";
    let user = null;

    // ---- ADMIN ----
    if (req.session.adminId) {
        userType = "admin";
       user = await Admin.findOne({ _id: req.session.adminId, schoolCode });
    }

    // ---- TEACHER ----
    else if (req.session.teacherId) {
        userType = "teacher";
        user = await Teacher.findOne({ _id: req.session.teacherId, schoolCode });
    }

    // ---- STUDENT ----
    else if (req.session.studentId && req.session.studentId.id) {
        userType = "student";
       user = await Student.findOne({ _id: req.session.studentId.id, schoolCode });
    }

    // No user logged in
    else {
        return res.redirect("/login");
    }

    res.render("Admin/setting", {
        userType,
        user,
        schoolCode: req.session.schoolCode
    });
});


// ---------------- CHANGE PASSWORD ROUTE ----------------
router.post("/change-password", anyAuth, async (req, res) => {
const schoolCode = req.session.schoolCode;

// 🔥 DEMO MODE CHECK: Agar demo school hai toh password update nahi hoga
    if (schoolCode === "DEMO248") {
        return res.send(`
            <script>
                alert('Security Notice: Password change is disabled in Demo Mode to keep the account accessible for everyone.');
                window.location='/setting';
            </script>
        `);
    }

    
    const { currentPassword, newPassword, confirmPassword } = req.body;

    let model = null;
    let id = null;

    // ------- ADMIN -------
    if (req.session.adminId) {
        model = Admin;
        id = req.session.adminId;
    }

    // ------- TEACHER -------
    else if (req.session.teacherId) {
        model = Teacher;
        id = req.session.teacherId;
    }

    // ------- STUDENT -------
    else if (req.session.studentId && req.session.studentId.id) {
        model = Student;
        id = req.session.studentId.id;
    }

    else {
        return res.redirect("/login");
    }

    // Get user from DB
   const user = await model.findOne({ _id: id, schoolCode });


    // 1️⃣ Check if CURRENT PASSWORD is correct
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
        return res.send("<script>alert('Current password is incorrect'); window.location='/setting';</script>");
    }

    // 2️⃣ Check NEW === CONFIRM
    if (newPassword !== confirmPassword) {
        return res.send("<script>alert('New password does not match'); window.location='/setting';</script>");
    }

    // Hashing password before saving
    const hashedPass = await bcrypt.hash(newPassword, 10);

    //  Save hashed password
    await model.findByIdAndUpdate(id, { password: hashedPass });

    return res.send(`
         <script>
            alert('Password updated successfully');
            window.location='/setting';
         </script>
    `);

});


router.get("/logout", anyAuth, (req, res) => {

    req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.redirect("/"); // नया login page
    });

});


module.exports = router;


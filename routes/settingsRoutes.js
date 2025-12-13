
const express = require('express')
const router = express.Router();

const Admin = require("../models/AdminProfileSchema")
const Teacher = require("../models/TeacherSchema")
const Student = require("../models/StudentSchema")
const bcrypt = require("bcrypt");


router.get("/setting", async (req, res) => {

    let userType = "";
    let user = null;

    // ---- ADMIN ----
    if (req.session.adminId) {
        userType = "admin";
        user = await Admin.findById(req.session.adminId);
    }

    // ---- TEACHER ----
    else if (req.session.teacherId) {
        userType = "teacher";
        user = await Teacher.findById(req.session.teacherId);
    }

    // ---- STUDENT ----
    else if (req.session.studentId && req.session.studentId.id) {
        userType = "student";
        user = await Student.findById(req.session.studentId.id);
    }

    // No user logged in
    else {
        return res.redirect("/login");
    }

    res.render("setting", {
        userType,
        user
    });
});


// ---------------- CHANGE PASSWORD ROUTE ----------------
router.post("/change-password", async (req, res) => {

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
    const user = await model.findById(id);

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


router.get("/logout", (req, res) => {

    let redirectPage = "/admin.html"; // default

    if (req.session.teacherId) {
        redirectPage = "/teacher.html";
    }
    else if (req.session.studentId) {
        redirectPage = "/student.html";
    }

    req.session.destroy(() => {
        res.redirect(redirectPage);
    });

});


module.exports = router;


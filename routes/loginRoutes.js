const express = require("express");
const router = express.Router();
const profile = require("../models/AdminProfileSchema");
const bcrypt = require("bcrypt");


const Teacher = require("../models/TeacherSchema");
const Student = require("../models/StudentSchema");


// ---------------- HTML ROUTES ----------------
// GET routes to render the login form for each role

router.get("/admin.html", (req, res) => {
  res.render("HomePage/loginForm", { title: "Admin Login", loginTitle: "Admin Login", role: "admin" });
});

router.get("/teacher.html", (req, res) => {
  res.render("HomePage/loginForm", { title: "Teacher Login", loginTitle: "Teacher Login", role: "teacher" });
});

router.get("/student.html", (req, res) => {
  res.render("HomePage/loginForm", { title: "Student Login", loginTitle: "Student Login", role: "student" });
});


// ---------------- LOGIN CHECK FUNCTION (UPDATED) ----------------

// This function checks the login credentials against the database.
// It now queries the database using the provided username to find the correct user.

async function checkLogin(role, username, password, TeacherSchema, StudentSchema) {
  // Check for Admin
  if (role === "admin") {
    const admin = await profile.findOne({ username });

    if (admin) {
      return await bcrypt.compare(password, admin.password);  // hashed compare
    }
  }


  // Check for Teacher
  if (role === "teacher") {
    // Find a teacher in the database with the given username
    const teacher = await TeacherSchema.findOne({ username: username });

    // If a teacher is found, check if the password matches
    if (teacher) {
      return await bcrypt.compare(password, teacher.password);
    }
  }

  // Check for Student
  if (role === "student") {
    // Find a student in the database with the given username
    const student = await StudentSchema.findOne({ username: username });

    // If a student is found, check if the password matches
    if (student) {
      return await bcrypt.compare(password, student.password);
    }
  }

  // If no user is found or credentials don't match, return false
  return false;
}

// ---------------- LOGIN ROUTE ----------------
// The main POST route for handling login form submissions

router.post("/login", async (req, res) => {

  const { role, username, password } = req.body;

  // Get the Mongoose Models from the app object
  const Teacher = req.app.get("Teacher");
  const Student = req.app.get("Student");

  // Call the updated checkLogin function
  const isValid = await checkLogin(role, username, password, Teacher, Student);

  if (isValid) {

    // Redirect to the appropriate dashboard on successful login
    if (role === "admin") {
      const admin = await profile.findOne({ username });
      req.session.adminId = admin._id;
      req.session.adminName = admin.name;
      return res.redirect("/adminDashboard");
    }


    if (role === "teacher") {
      const teacher = await Teacher.findOne({ username });
      req.session.teacherId = teacher._id,  // save logged in teacher id
        req.session.teacherName = teacher.name;

      return res.redirect("/teacherDashboard");
    }

    if (role === "student") {
      const student = await Student.findOne({ username });
      req.session.studentId = {
        id: student._id, // save logged in student id
        class: student.class,
      }

      return res.redirect("/studentDashboard");
    }
  }
  else {
    // Display an error message on failed login
    return res.redirect(`/${role}.html?error=1`);
  }
});


// Forget Password Routes: 


router.get("/forgot-password", (req, res) => {
  const role = req.query.role || "student"; // default student
  res.render("HomePage/forgotPassword", { role });
});


// ---------------- FORGOT PASSWORD SUBMIT ----------------
router.post("/forgot-password", async (req, res) => {
  try {
    const { role, username, dob, phone, newPassword, confirmPassword } = req.body;

    // 1️⃣ New == Confirm check
    if (newPassword !== confirmPassword) {
      return res.send(`
        <script>
          alert('New password does not match');
          window.location.href = '/forgot-password?role=${role}';
        </script>
      `);
    }

    let user = null;

    // 2️⃣ Find user based on role + details
    if (role === "admin") {
      // AdminProfileSchema: username + mobile
      user = await profile.findOne({
        username: username,
        mobile: phone
      });
    } else if (role === "teacher") {
      user = await Teacher.findOne({
        username: username,
        phone: phone
      });
    } else if (role === "student") {

      // ✨ Step 1: username match
      const student = await Student.findOne({ username: username });
      if (!student) user = null;
      else {

        const inputDate = new Date(dob); // example: "2002-05-19"
        const dbDate = new Date(student.DOB);

        // Compare year-month-day only
        const sameDate =
          inputDate.getFullYear() === dbDate.getFullYear() &&
          inputDate.getMonth() === dbDate.getMonth() &&
          inputDate.getDate() === dbDate.getDate();

        if (sameDate && student.phone == phone) {
          user = student;
        }
      }
    }

    // 3️⃣ If user not found → wrong details
    if (!user) {
      return res.send(`
        <script>
          alert('Details not found. Please check Username / DOB / Phone.');
          window.location.href = '/forgot-password?role=${role}';
        </script>
      `);
    }

    // 4️⃣ Hash new password
    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    // 5️⃣ Success → back to login page of that role
    return res.send(`
      <script>
        alert('Password updated successfully!');
        window.location.href = '/${role}.html';
      </script>
    `);
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.send(`
      <script>
        alert('Something went wrong. Please try again.');
        window.location.href = '/forgot-password?role=${req.body.role || "student"}';
      </script>
    `);
  }
});

module.exports = router;

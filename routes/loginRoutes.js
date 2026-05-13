const express = require("express");
const router = express.Router();
const profile = require("../models/AdminProfileSchema");
const bcrypt = require("bcrypt");
const School = require("../models/AllSchools")
const Teacher = require("../models/TeacherSchema")
const Student = require("../models/StudentSchema")

// ---------------- LOGIN CHECK FUNCTION (UPDATED) ----------------

// This function checks the login credentials against the database.
// It now queries the database using the provided username to find the correct user.

async function checkLogin(role, username, password, schoolCode, TeacherSchema, StudentSchema) {
  // Check for Admin

  if (role === "admin") {
    const admin = await profile.findOne({
      username: username.trim(),
      schoolCode: schoolCode.trim()
    });

    if (admin) {
      const match = await bcrypt.compare(password, admin.password);
      return match;
    }
  }


  // Check for Teacher
  if (role === "teacher") {
    // Find a teacher in the database with the given username

    const teacher = await TeacherSchema.findOne({
      username: username.trim().toLowerCase(),
      schoolCode: schoolCode.trim()
    });

    // If a teacher is found, check if the password matches
    if (teacher) {
      const match = await bcrypt.compare(password, teacher.password)

      return match;
    }
  }

  // Check for Student
  if (role === "student") {
    // Find a student in the database with the given username
    const student = await StudentSchema.findOne({
      username: username.trim(),
      schoolCode: schoolCode.trim()
    });

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
  const { role, username, password, schoolCode } = req.body;

  try {
    // 1. School check (Subscription & Existence)
    const school = await School.findOne({ code: schoolCode.trim() });
    if (!school) {
      return res.redirect(`/login?error=Invalid School Code`);
    }

    const isExpired = school.status === 'Inactive' || (school.subscriptionEnd && new Date() > school.subscriptionEnd);
    if (isExpired && role !== "admin") {
      return res.render("Admin/subscriptionBlocked", { role: role.charAt(0).toUpperCase() + role.slice(1) });
    }

    // 2. Credential Check
    const isValid = await checkLogin(role, username, password, schoolCode, Teacher, Student);
    if (!isValid) {
      return res.redirect(`/login?error=1`);
    }

    // 3. User Data Fetch (Before Session Change)
    let userData = null;
    if (role === "admin") {
      userData = await profile.findOne({ username: username.trim(), schoolCode: schoolCode.trim() });
    } else if (role === "teacher") {
      userData = await Teacher.findOne({ username: username.trim().toLowerCase(), schoolCode: schoolCode.trim() });
    } else if (role === "student") {
      userData = await Student.findOne({ username: username.trim(), schoolCode: schoolCode.trim() });
    }

    if (!userData) {
      return res.redirect(`/login?error=User Data Not Found`);
    }

    // 4. 🔥 SESSION REGENERATE (Purana sab khatam)
    req.session.regenerate((err) => {
      if (err) {
        console.error("Session regenerate error:", err);
        return res.redirect(`/login?error=1`);
      }

      // 5. Common Data Set Karo
      req.session.userRole = role;
      req.session.schoolCode = schoolCode.trim();
      req.session.schoolName = school.name;

      // 6. Role-Specific Data & Clean-up (Just to be 100% sure)
      // Regenerate sab clean kar deta hai, par hum specific IDs initialize kar rahe hain
      req.session.adminId = null;
      req.session.teacherId = null;
      req.session.studentId = null;

      if (role === "admin") {
        req.session.adminId = userData._id;
        req.session.adminName = userData.name;
      } else if (role === "teacher") {
        req.session.teacherId = userData._id;
        req.session.teacherName = userData.name;
      } else if (role === "student") {
        req.session.studentId = {
          id: userData._id,
          class: userData.class
        };
      }

      // 7. ✅ FINAL SAVE & REDIRECT
      // Is callback ke bina redirect kiya toh 2-attempt wala bug aayega
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("Session Save Error:", saveErr);
          return res.redirect("/login?error=1");
        }

        // Success! Redirecting to Dashboard
        if (role === "admin") return res.redirect("/adminDashboard");
        if (role === "teacher") return res.redirect("/teacherDashboard");
        if (role === "student") return res.redirect("/studentDashboard");
      });
    });

  } catch (error) {
    console.error("Login System Crash:", error);
    return res.status(500).send("Internal Server Error");
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

    if (req.body.schoolCode === "DEMO248") {
    return res.send("<script>alert('Forgot Password is disabled in Demo Mode'); window.history.back();</script>");
}

    const { role, username, dob, phone, newPassword, confirmPassword, schoolCode } = req.body;

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
        mobile: phone,
        schoolCode
      });
    } else if (role === "teacher") {
      user = await Teacher.findOne({
        username: username,
        phone: phone,
        schoolCode
      });
    } else if (role === "student") {

      // ✨ Step 1: username match
      const student = await Student.findOne({ username: username, schoolCode });
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
        window.location.href = '/login';
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

// --- Route to show Demo Credentials Page ---
router.get("/try-demo", (req, res) => {
    res.render("HomePage/demo-access", { demoCode: "DEMO248" }); 
});


module.exports = router;

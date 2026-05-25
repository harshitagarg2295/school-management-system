const School = require("../models/AllSchools");

module.exports = {

  adminAuth: async (req, res, next) => {
    try {

      if (req.session.adminId && req.session.schoolCode && req.session.userRole === "admin") {
        const school = await School.findOne({ code: req.session.schoolCode });

        // Check if school is Inactive or Expired
        const isBlocked = !school || school?.status === 'Inactive' || (school.subscriptionEnd && new Date() > school.subscriptionEnd);
        if (isBlocked) {
          // Admin ko dashboard bhi mat dikhao, seedha block page!
          return res.render("Admin/subscriptionBlocked", { role: 'Admin', status: school?.status });
        }
        return next();
      }
      return res.redirect("/login");

    } catch (err) {
      console.log("Admin Auth Error:", err);
      return res.redirect("/login");
    }
  },

  teacherAuth: async (req, res, next) => {
    try {

      if (req.session.teacherId && req.session.schoolCode) {
        const school = await School.findOne({ code: req.session.schoolCode });
        const isExpired = !school || school?.status === 'Inactive' || (school.subscriptionEnd && new Date() > school.subscriptionEnd);

          // Teachers ko dashboard se bhi block kar sakte hain ya login page par bhej sakte hain
          if (isExpired) {
            return res.render("Admin/subscriptionBlocked", { role: 'Teacher', status: school?.status });
          }
        return next();
      }
      res.redirect("/login");
    } catch (err) {
      console.log("Teacher Auth Error:", err);
      return res.redirect("/login");
    }
  },

  // Student Check
  studentAuth: async (req, res, next) => {
    try {

      if (req.session.studentId && req.session.schoolCode) {
        const school = await School.findOne({ code: req.session.schoolCode });
        const isExpired = !school || school?.status === 'Inactive' || (school.subscriptionEnd && new Date() > school.subscriptionEnd);

        if (isExpired) {
          return res.render("Admin/subscriptionBlocked", {
            role: 'Student', status: school?.status

          });
        }
        return next();
      }
      res.redirect("/login");
    } catch (err) {
      console.log("Student Auth Error:", err);
      return res.redirect("/login");
    }
  },

  anyAuth: (req, res, next) => {
    if (
      (req.session.adminId ||
        req.session.teacherId ||
        req.session.studentId) &&
      req.session.schoolCode   // 🔥 ADD THIS
    ) {
      return next();
    }
    return res.redirect("/login");
  },

  superAdminAuth: (req, res, next) => {
    if (req.session.superAdminId) return next();

    return res.redirect("/super-admin/login");
  }
};
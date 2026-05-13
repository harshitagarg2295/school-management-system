const School = require("../models/AllSchools");

module.exports = {

  adminAuth: async (req, res, next) => {
    if (req.session.adminId && req.session.schoolCode && req.session.userRole === "admin") {

      const school = await School.findOne({ code: req.session.schoolCode });
      const isExpired = !school || school.status === 'Inactive' || (school.subscriptionEnd && new Date() > school.subscriptionEnd);

      if (isExpired) {
        // Agar Admin Dashboard ke alawa kahi bhi jane ki koshish kare, toh block!
        if (req.path !== "/adminDashboard") {
          return res.send(`
                    <script>
                        alert("Your subscription has expired. Please renew from the dashboard.");
                        window.location.href = "/adminDashboard";
                    </script>
                `);
        }
      }
      return next();
    }
    return res.redirect("/login");
  },

  teacherAuth: async (req, res, next) => {
    if (req.session.teacherId && req.session.schoolCode) {
      const school = await School.findOne({ code: req.session.schoolCode });
      const isExpired = !school || school.status === 'Inactive' || (school.subscriptionEnd && new Date() > school.subscriptionEnd);

      if (isExpired) {
        // Teachers ko dashboard se bhi block kar sakte hain ya login page par bhej sakte hain
        if (isExpired) {
          return res.render("Admin/subscriptionBlocked", { role: 'Teacher' });
        }
      }
      return next();
    }
    res.redirect("/login");
  },

  // Student Check
  studentAuth: async (req, res, next) => {
    if (req.session.studentId && req.session.schoolCode) {
      const school = await School.findOne({ code: req.session.schoolCode });
      const isExpired = !school || school.status === 'Inactive' || (school.subscriptionEnd && new Date() > school.subscriptionEnd);

      if (isExpired) {
        return res.render("Admin/subscriptionBlocked", { role: 'Student' });
      }
      return next();
    }
    res.redirect("/login");
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
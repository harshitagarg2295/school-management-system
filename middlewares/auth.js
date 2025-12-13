module.exports = {
    
    adminAuth: (req, res, next) => {
        if (req.session.adminId) return next();
        return res.redirect("/admin.html");
    },

    teacherAuth: (req, res, next) => {
        if (req.session.teacherId) return next();
        return res.redirect("/teacher.html");
    },

    studentAuth: (req, res, next) => {
        if (req.session.studentId) return next();
        return res.redirect("/student.html");
    }

};

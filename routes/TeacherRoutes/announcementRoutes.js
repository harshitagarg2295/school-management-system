const express = require('express')
const router = express.Router()
const Announcement = require("../../models/Announcement")
const Student = require("../../models/StudentSchema")
const { adminAuth, teacherAuth } = require("../../middlewares/auth");
const mongoose = require('mongoose')


// This file hold add and view route of announcements for teachers and admin (both)

// Announcemt related routes for Teachers
router.get("/teachers/add-announcement", teacherAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  const classList = await Student.distinct("class", { schoolCode });
  const classOrder = [
    "Nursery", "LKG", "UKG",
    "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
    "11", "12"
  ];

  classList.sort((a, b) => {
    const idxA = classOrder.indexOf(a);
    const idxB = classOrder.indexOf(b);

    // Jo classOrder me na ho, unko end me push kar do
    return (idxA === -1 ? Infinity : idxA) - (idxB === -1 ? Infinity : idxB);
  });
  res.render("Teachers/addAnnouncement", {
    classList,
    role: "teacher",
    status: req.query.status || null,
    errorMessage: null,
    editData: null
  });
});


// Save the form (POST request)
router.post("/teachers/add-announcement", teacherAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  const { title, description, date, class: className } = req.body;

  const teacherName = req.session.teacherName;

  await Announcement.create({
    title,
    description,
    date,
    class: className || "All",
    by: "Teacher",
    teacherName: teacherName,
    schoolCode
  });
  res.redirect("/teachers/add-announcement?status=success");
})

// Teacher View Announcements
router.get("/teachers/view-announcement", teacherAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  const teacherName = req.session.teacherName;

  const announcements = await Announcement.find({
    schoolCode,
    $or: [
      { by: "Teacher", teacherName: teacherName },  // teacher ki apni announcements
      { by: "Principal", target: "teacher" }        // admin ki teacher ke liye wali
    ]
  }).sort({ date: -1 });

  res.render("Students/viewAnnouncement", { announcements, role: "teacher", teacherName, updated: req.query.updated });
});


// Announcemt related routes for Admin

router.get("/admin/add-announcement", adminAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  const classList = await Student.distinct("class", { schoolCode });
  const classOrder = [
    "Nursery", "LKG", "UKG",
    "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
    "11", "12"
  ];

  classList.sort((a, b) => {
    const idxA = classOrder.indexOf(a);
    const idxB = classOrder.indexOf(b);
    return (idxA === -1 ? Infinity : idxA) - (idxB === -1 ? Infinity : idxB);
  });

  res.render("Teachers/addAnnouncement", {
    classList,
    role: "admin",
    status: req.query.status || null,
    errorMessage: null,
    editData: null
  });
});


router.post("/admin/add-announcement", adminAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  const { title, description, date, class: className } = req.body;

  let target = "student";
  let cls = className || "All";

  if (className === "Teachers") {
    target = "teacher";
    cls = null;   // teacher ke liye class ki zaroorat nahi
  }

  await Announcement.create({
    title,
    description,
    date,
    class: cls,
    by: "Principal",
    teacherName: null,
    target,
    schoolCode
  });

  res.redirect("/admin/add-announcement?status=success");
});


// Admin View Announcements
router.get("/admin/view-announcement", adminAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  const announcements = await Announcement.find({ schoolCode }).sort({ date: -1 });

  res.render("Students/viewAnnouncement", { announcements, role: "admin", updated: req.query.updated });
});

// Function for redirect
function redirectByRole(req, res, extraQuery = "") {
  if (req.session.adminId) {
    return res.redirect("/admin/view-announcement" + extraQuery);
  }
  if (req.session.teacherId) {
    return res.redirect("/teachers/view-announcement" + extraQuery);
  }
  return res.redirect("/login"); // fallback
}


// Edit announcement 
router.get("/announcement/edit/:id", async (req, res) => {
  const schoolCode = req.session.schoolCode;
  // 🔐 login check
  if (!req.session.adminId && !req.session.teacherId) {
    return redirectByRole(req, res);
  }

  // 🧪 ObjectId validation
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return redirectByRole(req, res);
  }

  const ann = await Announcement.findOne({ _id: req.params.id, schoolCode })
  if (!ann) {
    return redirectByRole(req, res);
  }

  // 🔐 permission check
  const isAdmin = !!req.session.adminId;
  const isTeacherOwner =
    req.session.teacherId &&
    ann.by === "Teacher" &&
    ann.teacherName === req.session.teacherName;

  if (!isAdmin && !isTeacherOwner) {
    return redirectByRole(req, res);
  }

  // 📚 class list
  const classList = await Student.distinct("class", { schoolCode });

  // ✅ SAME EJS (edit mode)
  return res.render("Teachers/addAnnouncement", {
    editData: ann,
    classList,
    role: isAdmin ? "admin" : "teacher",
    status: null,
    errorMessage: null
  });
});


// Update announcement 
router.post("/announcement/edit/:id", async (req, res) => {
  const schoolCode = req.session.schoolCode;
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return redirectByRole(req, res);
  }

  const ann = await Announcement.findOne({ _id: req.params.id, schoolCode })
  if (!ann) {
    return redirectByRole(req, res);
  }

  const isAdmin = !!req.session.adminId;
  const isTeacherOwner =
    req.session.teacherId &&
    ann.by === "Teacher" &&
    ann.teacherName === req.session.teacherName;

  if (!isAdmin && !isTeacherOwner) {
    return redirectByRole(req, res);
  }

  const { title, description, date, class: className } = req.body;

  ann.title = title;
  ann.description = description;
  ann.date = date;
  if (className) ann.class = className;

  await ann.save();

  // ✅ CORRECT redirect
  return redirectByRole(req, res, "?updated=1");
});



// Delete Announcement
router.post("/announcement/delete/:id", async (req, res) => {
  const schoolCode = req.session.schoolCode;
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return redirectByRole(req, res);
  }

  const ann = await Announcement.findOne({ _id: req.params.id, schoolCode })
  if (!ann) {
    return redirectByRole(req, res);
  }

  const isAdmin = !!req.session.adminId;
  const isTeacherOwner =
    req.session.teacherId &&
    ann.by === "Teacher" &&
    ann.teacherName === req.session.teacherName;

  if (!isAdmin && !isTeacherOwner) {
    return redirectByRole(req, res);
  }

  await Announcement.findOneAndDelete({
    _id: req.params.id,
    schoolCode
  });

  // ✅ CORRECT redirect
  return redirectByRole(req, res);
});



module.exports = router
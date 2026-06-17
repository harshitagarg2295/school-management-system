// This file handle all the routes related to our website


// https://school-management-system-trft.onrender.com  my website live link :
require("dotenv").config(); // for mongoDB atlas connection string


const express = require('express');
const path = require('path');

const mongoose = require('mongoose')

const app = express();

const helmet = require("helmet");
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

const rateLimit = require("express-rate-limit");
const limiter = rateLimit({

  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests. Please try again later."
});
app.use("/login", limiter);

app.use("/create-order", limiter);

app.use("/verify-payment", limiter);

app.set("trust proxy", 1);

// Store cookie store sessionId in browser while connect-mongo store sessionId in mongoDB Atlas
const session = require("express-session");
const MongoStore = require("connect-mongo").default;


const isProduction = process.env.NODE_ENV === "production";

app.use(
  session({
    name: "school.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,               // User active hai toh session extend hota rahega
    store: new MongoStore({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
    }),
    cookie: {
      secure: isProduction,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 4, // Maine ise 4 ghante kar diya hai (School shift ke hisab se)
    },
  })
);

app.use((req, res, next) => {
  res.locals.schoolName = req.session.schoolName || "";
  next();
});

// Set view engine to EJS
app.set("view engine", "ejs");

// Set views directory
app.set("views", [
  path.join(__dirname, "templates")
]);

//Serve static files (CSS, images, JS, etc.) from public folder
app.use(express.static(path.join(__dirname, "public")));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Yeh middleware Express ko allow karta hai HTML form ke data ko req.body me read karne ke liye.
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.use(express.json({ limit: "10mb" }));


app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});


// Landing Page (Home + Login)
app.get('/', (req, res) => res.render('HomePage/index'));
app.get('/about-us', (req, res) => res.render('HomePage/about-us'));
app.get('/features', (req, res) => res.render('HomePage/features'));
app.get('/contact-us', (req, res) => res.render('HomePage/contact-us'));

// Legal Pages for Razorpay
app.get('/privacy-policy', (req, res) => res.render('HomePage/privacy-policy'));
app.get('/terms-conditions', (req, res) => res.render('HomePage/terms-conditions'));
app.get('/refund-policy', (req, res) => res.render('HomePage/refund-policy'));
app.get('/login', (req, res) => res.render('HomePage/login'));
app.get('/try-demo', (req, res) => res.render('HomePage/demo-access'));

app.get("/app", (req, res) => {

  if (req.session.adminId) {
    return res.redirect("/adminDashboard");
  }

  if (req.session.teacherId) {
    return res.redirect("/teacherDashboard");
  }

  if (req.session.studentId) {
    return res.redirect("/studentDashboard");
  }

  return res.redirect("/login");
});

// Login for all (student, teacher & admin)

const Teacher = require("./models/TeacherSchema");
const Student = require("./models/StudentSchema");

app.set("Teacher", Teacher);
app.set("Student", Student);

const superAdminRoutes = require("./routes/SuperAdminRoutes/superAdminRoutes");
app.use(superAdminRoutes)

const loginRoutes = require("./routes/loginRoutes");
app.use("/", loginRoutes);


const settingRoutes = require("./routes/settingsRoutes");
app.use("/", settingRoutes);



//  <---- Admin Dashboard related routes ---->

// Route for upload Biometric
const uploadBiometricRoute = require("./routes/AdminRoutes/uploadBiometricRoutes");
app.use(uploadBiometricRoute);

// Route for Bulk Excel Upload (Students, Teachers, Staff)
const bulkUploadRoute = require("./routes/AdminRoutes/bulkUploadRoutes");
app.use(bulkUploadRoute);

// Routes for Admin Dashboard
const adminDashboardRoute = require("./routes/AdminRoutes/adminDashBoardRoutes");
app.use(adminDashboardRoute);

// Routes for teachers 
const teacherRoutes = require("./routes/AdminRoutes/teacherRoutes");
app.use(teacherRoutes);

// Routes for Staffs
const staffRoutes = require("./routes/AdminRoutes/staffRoutes");
app.use(staffRoutes);

// Routes for Student
const studentRoutes = require("./routes/AdminRoutes/studentRoutes");
app.use(studentRoutes);

// Route for students fees page :
const studentFeesRoute = require("./routes/AdminRoutes/studentFeesRoutes");
app.use(studentFeesRoute);

// Route for fees collection :
const feesCollectionRoute = require("./routes/AdminRoutes/feesCollectionRoutes");
app.use(feesCollectionRoute);

// Route for fees collection :
const schoolExpensesRoute = require("./routes/AdminRoutes/schoolExpensesRoutes");
app.use(schoolExpensesRoute);

// Route for add timetable:
const timetableRoute = require("./routes/AdminRoutes/timetableRoutes");
app.use(timetableRoute);

// Route for calendar:
const calendarRoute = require("./routes/AdminRoutes/calendarRoutes");
app.use(calendarRoute);

// Route for profile
const profileRoute = require("./routes/AdminRoutes/profileRoutes");
app.use(profileRoute);

const bankSetupRoute = require("./routes/AdminRoutes/bankSetupRoutes");
app.use(bankSetupRoute);

//  <---- Teaacher Dashboard related routes ---->


// Routes for Teacher Dashboard
const teacherDashboardRoute = require("./routes/TeacherRoutes/teacherDashboardRoutes");
app.use(teacherDashboardRoute);

// Route for mark Student Attendance
const markAttendanceRoute = require("./routes/TeacherRoutes/markAttendanceRoutes");
app.use(markAttendanceRoute);


// Route for view own Attendance (Teachers)
const viewOwnAttendanceRoute = require("./routes/TeacherRoutes/viewOwnAttendanceRoutes");
app.use(viewOwnAttendanceRoute);


// Route for submit students result
const { router: submitResultRoute } = require("./routes/TeacherRoutes/submitResultRoutes");
app.use(submitResultRoute); // this is passedd in a different way because we also export a function in this file

// Route for view salary status (Teachers)
const salaryStatusRoute = require("./routes/TeacherRoutes/salaryStatusRoutes");
app.use(salaryStatusRoute);

// Route for add announcement 
const announcementRoute = require("./routes/TeacherRoutes/announcementRoutes");
app.use(announcementRoute);

// Route for add syllabus
const syllabusRoute = require("./routes/TeacherRoutes/syllabusRoutes");
app.use(syllabusRoute);

// Route for upload study material
const studyMaterialRoute = require("./routes/TeacherRoutes/studyMaterialRoutes");
app.use(studyMaterialRoute);

const teacherProfileRoute = require("./routes/TeacherRoutes/profileRoutes");
app.use(teacherProfileRoute);


//  <---- Student Dashboard related routes ---->


// Routes for Student Dashboard
const studentDashboardRoute = require("./routes/StudentRoutes/studentDashboardRoutes");
app.use(studentDashboardRoute);

// Route for view own Attendance (Students)
const studentAttendanceRoute = require("./routes/StudentRoutes/studentAttendanceRoutes");
app.use(studentAttendanceRoute);

// Route for view Result
const viewResultRoute = require("./routes/StudentRoutes/viewResultRoutes");
app.use(viewResultRoute)

// Route for view own Fee Status(Students)
const feeStatusRoute = require("./routes/StudentRoutes/feeStatusRoutes");
app.use(feeStatusRoute);

// Route for view announcement
const viewAnnouncementRoute = require("./routes/StudentRoutes/viewAnnouncementRoutes");
app.use(viewAnnouncementRoute);

// Route for view study material
const studentViewMaterialRoute = require("./routes/StudentRoutes/studentViewMaterialRoutes");
app.use(studentViewMaterialRoute);

// Route for view timetable
const viewTimetableRoute = require("./routes/StudentRoutes/viewTimetableRoutes");
app.use(viewTimetableRoute);

// Route for view syllabus
const viewSyllabusRoute = require("./routes/StudentRoutes/viewSyllabusRoutes");
app.use(viewSyllabusRoute);

// Route for payFees
const checkOutFeesRoute = require("./routes/StudentRoutes/checkOutFeesRoutes");
app.use(checkOutFeesRoute);

// Route for Actual payment
const paymentRoute = require("./routes/StudentRoutes/paymentRoutes");
app.use(paymentRoute);

const studentProfileRoute = require("./routes/StudentRoutes/profileRoutes");
app.use(studentProfileRoute);


// MongoDB connection
const PORT = process.env.PORT || 3005;
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");

    // ✅ Import cleanup scheduler
    require("./cleanupNotifications");  // <- important line

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => console.log(err));

app.use((req, res) => {

  res.status(404).render(
    "HomePage/404"
  );
});

app.use((err, req, res, next) => {

  console.error(err);

  res.status(500).render(
    "HomePage/500"
  );
});
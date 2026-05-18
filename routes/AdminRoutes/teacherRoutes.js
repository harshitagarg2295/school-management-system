const express = require("express");
const router = express.Router();
const moment = require("moment-timezone");

const Teacher = require("../../models/TeacherSchema");
const Attendance = require("../../models/TeacherAttendance");
const Holiday = require("../../models/Holiday");
const SalaryStatus = require("../../models/TeacherSalaryStatus");
const AdminNotification = require("../../models/AdminNotificationSchema");
const Expense = require("../../models/Expense");
const createSalaryExpense = require("../../utils/createSalaryExpense");
const { adminAuth } = require("../../middlewares/auth");
const Student = require("../../models/StudentSchema");
const bcrypt = require("bcrypt");
const { cloudinary } = require("../../config/cloudinaryConfig");


// List all teachers
router.get("/teach-menu", adminAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  const admin = await AdminNotification.findOne({ schoolCode }) || { notifications: [] };
  const teachers = await Teacher.find({ schoolCode }).sort({ name: 1 });
  res.render("Admin/teachers_list", { teachers, admin });
});

// Add teacher
router.post("/add-teacher", adminAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  const toTitleCase = str => str.replace(/\w\S*/g, txt =>
    txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );

  const { name, empId, subject, salary, dob, phone, class: className } = req.body;

  // name is in lowercase
  // Example logic: username = first 3 letters of name + @ + last4 mobile
  // password = first 2 letters of name + @ + DDMM (dob) + last2 mobile

  // 👉 clean name (no spaces)
  const cleanName = name.toLowerCase().replace(/\s+/g, "");

  // 👉 name parts
  const name3 = cleanName.slice(0, 3);
  const name2 = cleanName.slice(0, 2);

  // 👉 mobile parts
  const phoneStr = phone.toString();
  const last4 = phoneStr.slice(-4);
  const last2 = phoneStr.slice(-2);

  // 👉 username
  const username = `${name3}@${last4}`;

  // 👉 DOB format (DDMM)
  // 👉 DOB format (DDMM)
  let dobPart = "0000";

  if (req.body.dob) {
    const [year, month, day] = req.body.dob.split("-");
    dobPart = day + month;
  }

  // 👉 password
  const rawPassword = `${name2}@${dobPart}${last2}`;
  console.log("🔥 GENERATED PASSWORD:", rawPassword);

  // 🔐 HASH PASSWORD
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  const teacher = new Teacher({
    name: toTitleCase(name),
    empId: empId?.toUpperCase() || "",
    subject: toTitleCase(subject),
    class: className.toUpperCase(),
    dob,
    salary,
    phone,
    username,
    password: hashedPassword,
    schoolCode
  });

  const savedTeacher = await teacher.save();

  // 🔥 IMPORTANT: redirect to profile page
  return res.redirect(`/teacher/${savedTeacher._id}`);
});

router.get("/teacher/:id", adminAuth, async (req, res) => {
  try {
    const schoolCode = req.session.schoolCode;
    const teacher = await Teacher.findOne({
      _id: req.params.id,
      schoolCode: req.session.schoolCode
    });

    if (!teacher) {
      return res.send("Teacher not found");
    }
    // 🔥 DB से classes fetch
    const classList = await Student.distinct("class", { schoolCode });
    const sortedClasses = classList.sort();

    res.render("Admin/teacherProfile", {
      teacher,
      classes: sortedClasses
    });

  } catch (err) {
    console.log(err);
    res.send("Error loading profile");
  }
});

// Delete teacher
router.post("/delete-teacher/:id", adminAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  const teacher = await Teacher.findById(req.params.id);

  if (teacher && teacher.username === "teacher_demo") {
    return res.send(`
                <script>
                    alert('Notice: This is a default Demo Teacher. You cannot delete it, but you can delete any new teacher you create.');
                    window.history.back();
                </script>
            `);
  }

  await Teacher.findOneAndDelete({
    _id: req.params.id,
    schoolCode
  });
  res.redirect("/teach-menu");
});

// Edit teacher
router.post("/edit-teacher/:id", adminAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  const toTitleCase = (str) => {
    if (!str) return "";   // 🔥 important
    return str.replace(/\w\S*/g, txt =>
      txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
    );
  };

  const { name, empId, subject, class: className, salary, address, phone } = req.body;

  const updateData = {};

  if (name) updateData.name = toTitleCase(name);
  if (empId) updateData.empId = empId.trim().toUpperCase();
  if (subject) updateData.subject = toTitleCase(subject);
  if (className) updateData.class = className.trim().toUpperCase();
  if (address) updateData.address = toTitleCase(address);
  if (salary) updateData.salary = salary;
  if (phone) updateData.phone = phone;

  if (req.body.gender) updateData.gender = req.body.gender;
  if (req.body.dob) updateData.dob = req.body.dob;
  if (req.body.bloodGroup) updateData.bloodGroup = req.body.bloodGroup;
  if (req.body.education) updateData.education = req.body.education;
  if (req.body.experience) updateData.experience = req.body.experience;
  if (req.body.joiningDate) updateData.joiningDate = req.body.joiningDate;
  if (req.body.classTeacher) updateData.classTeacher = req.body.classTeacher;
  if (req.body.assignedClass) updateData.assignedClass = req.body.assignedClass;

  await Teacher.findOneAndUpdate(
    { _id: req.params.id, schoolCode },
    { $set: updateData }
  );

  res.redirect(`/teacher/${req.params.id}`);
});

router.post("/teacher/upload-image/:id", adminAuth, async (req, res) => {
  try {
    const base64 = req.body.croppedImage;
    
    // Agar image nahi aayi toh chupchap redirect kar do
    if (!base64 || base64.trim() === "") {
      return res.redirect(`/teacher/${req.params.id}`);
    }

    // 🔒 Secure check: Pehle verify kar lo ki teacher usi school ka hai
    const teacher = await Teacher.findOne({
      _id: req.params.id,
      schoolCode: req.session.schoolCode
    });

    if (!teacher) {
      return res.status(404).send("Teacher not found or unauthorized");
    }

    // 🔥 CLOUDINARY UPLOAD (No fs, no path, direct base64 string upload!)
    const uploadResponse = await cloudinary.uploader.upload(base64, {
      folder: "School_Management_Profiles/Teachers",
      resource_type: "image"
    });

    // 🔄 Database me direct online secure URL save karo
    await Teacher.findOneAndUpdate(
      { _id: req.params.id, schoolCode: req.session.schoolCode },
      { photo: uploadResponse.secure_url }
    );

    res.redirect(`/teacher/${req.params.id}`);

  } catch (err) {
    console.error("Error uploading teacher image to Cloudinary:", err);
    res.status(500).send("Error uploading image");
  }
});

// 👉 Declare Holiday (for teachers)
router.post("/mark-teacher-holiday", adminAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  const { date, reason } = req.body;
  let holidayDate = moment.utc(date, "YYYY-MM-DD").startOf("day").toDate();

  let existing = await Holiday.findOne({ date: holidayDate, role: "teacher", schoolCode });
  if (existing) {
    existing.reason = reason;
    await existing.save();
  } else {
    await Holiday.create({ role: "teacher", date: holidayDate, reason, schoolCode });
  }
  res.redirect("/view-attendance-teachers");
});


// 👉 View Attendance Page
router.get("/view-attendance-teachers", adminAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  try {
    const teachers = await Teacher.find({ schoolCode }).sort({ name: 1 });

    const month = parseInt(req.query.month) || parseInt(moment().format("MM"));
    const year = parseInt(req.query.year) || parseInt(moment().format("YYYY"));

    const startOfMonth = moment.utc(`${year}-${month}-01`, "YYYY-MM-DD").startOf("day").toDate();
    const endOfMonth = moment.utc(startOfMonth).endOf("month").toDate();
    const daysInMonth = moment(`${year}-${month}`, "YYYY-MM").daysInMonth();

    // Sundays
    const sundays = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const date = moment.utc(`${year}-${month}-${i}`, "YYYY-MM-DD");
      if (date.day() === 0) sundays.push(i);
    }

    // Holidays
    const allHolidays = await Holiday.find({
      role: "teacher",
      schoolCode,
      date: { $gte: startOfMonth, $lte: endOfMonth },
    });

    // Show holiday reason
    const holidayReasons = {};
    allHolidays.forEach(h => {
      holidayReasons[moment.utc(h.date).date()] = h.reason;
    });


    const holidayDates = allHolidays.map(h => moment.utc(h.date).date());

    // Attendance
    const attendanceData = await Attendance.find({
      schoolCode,
      date: { $gte: startOfMonth, $lte: endOfMonth },
    });

    const attendanceMap = {};
    attendanceData.forEach(a => {
      const day = moment.utc(a.date).date();
      const tid = a.teacherId.toString();
      if (!attendanceMap[tid]) attendanceMap[tid] = {};
      attendanceMap[tid]["day_" + day] = a.status;
    });

    // Salary Calculation
    const salaryData = {};
    for (let teacher of teachers) {
      const tid = teacher._id.toString();
      const dailySalary = Math.round(teacher.salary / daysInMonth);
      const attendance = attendanceMap[tid] || {};

      // Get absent days + late count
      let absentDays = 0;
      let lateCount = 0;
      let paidDays = 0;
      let hasAttendanceData = false; // 🔥 CHECK: Kya is mahine me koi bhi attendance bhari gayi hai?

      // Pata karo loop kahan tak chalana hai
      const currentMoment = moment();
      let loopUpToDay = daysInMonth;

      // Agar selected month aur year AAJ KA chal raha mahina hai:
      if (month === parseInt(currentMoment.format("MM")) && year === parseInt(currentMoment.format("YYYY"))) {
        loopUpToDay = parseInt(currentMoment.format("D")); // Toh loop sirf AAJ KI DATE tak hi chalega
      }

      // First Pass: Pehle check karo kya pure loop me kahin bhi P, A, ya L bhara hua hai?
      for (let day = 1; day <= loopUpToDay; day++) {
        const status = attendance["day_" + day];
        if (status === "P" || status === "A" || status === "L") {
          hasAttendanceData = true; // Haan, attendance bhari hui hai!
          break;
        }
      }

      // Second Pass: Agar attendance data hai, tabhi salary calculate karo, nahi toh sab 0 rahega
      if (hasAttendanceData) {
        for (let day = 1; day <= loopUpToDay; day++) {
          const status = attendance["day_" + day];
          const isSundayOrHoliday = sundays.includes(day) || holidayDates.includes(day);

          // 1. Agar Sunday ya School Holiday hai
          if (isSundayOrHoliday) {
            if (status !== "A") {
              paidDays++; // Sunday/Holiday ka paisa mil gaya
            } else {
              absentDays++;
            }
          }
          // 2. Agar normal working day hai
          else {
            if (status === "P" || status === "L") {
              paidDays++;
            } else if (status === "A") {
              absentDays++;
            }
          }

          // Late count calculation
          if (status === "L" && !isSundayOrHoliday) {
            lateCount++;
          }
        }
      }

      // Har 2 Late = 1 extra absent deduction
      const lateDeductionDays = Math.floor(lateCount / 2);
      const totalAbsent = absentDays + lateDeductionDays;

      // FINAL SALARY FORMULA
      let finalWorkingDays = hasAttendanceData ? (paidDays - lateDeductionDays) : 0;
      if (finalWorkingDays < 0) finalWorkingDays = 0;

      // Final Calculation (Agar data hi nahi h toh payable b 0 aur deduction b 0)
      const payableSalary = hasAttendanceData ? Math.round(finalWorkingDays * dailySalary) : 0;
      const deduction = hasAttendanceData ? Math.round(totalAbsent * dailySalary) : 0;

      // Present days count (jo screen par dikhane k liye chahiye)
      let presentDays = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        if (attendance["day_" + day] === "P" || attendance["day_" + day] === "L") presentDays++;
      }

      // Fetch salary status for this teacher, month, year
      let statusDoc = await SalaryStatus.findOne({
        teacherId: teacher._id,
        month,
        year,
        schoolCode
      });

      if (!statusDoc) {
        statusDoc = await SalaryStatus.create({
          teacherId: teacher._id,
          month,
          year,
          totalSalary: teacher.salary,
          payableSalary,
          absentDays,
          presentDays,
          totalAbsent,
          lateCount,
          deduction,
          status: "pending",
          schoolCode
        });
      }
      else {
        // Update if exists (so data remains accurate if attendance changes)
        statusDoc.totalSalary = teacher.salary;
        statusDoc.payableSalary = payableSalary;
        statusDoc.absentDays = absentDays;
        statusDoc.presentDays = presentDays;
        statusDoc.lateCount = lateCount;
        statusDoc.totalAbsent = totalAbsent;
        statusDoc.deduction = deduction;
        await statusDoc.save();
      }

      salaryData[tid] = {
        absentDays,
        presentDays,
        lateCount,
        totalAbsent,
        dailySalary,
        totalSalary: teacher.salary,
        payableSalary,
        deduction,
        status: statusDoc.status,
      };
    }

    const today = parseInt(moment().format("D"));

    res.render("Admin/view_teacher_attendance", {
      teachers,
      month,
      year,
      daysInMonth,
      sundays,
      holidays: holidayDates,
      holidayReasons,
      moment,
      attendanceMap,
      today,
      salaryData,
    });
  } catch (err) {
    console.error("Error in /view-attendance-teachers:", err);
    res.status(500).send("Error loading attendance data.");
  }
});


// 👉 Submit Attendance
router.post("/submit-attendance-teachers", adminAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  let { attendance = {}, paymentStatus = {}, month, year } = req.body;

  // Always work in IST
  const serverToday = moment.tz("Asia/Kolkata").startOf("day");

  try {
    for (const teacherId in attendance) {
      const daily = attendance[teacherId];

      for (const dayKey in daily) {
        const status = daily[dayKey];
        if (!["P", "A", "L"].includes(status)) continue;

        const day = parseInt(dayKey.replace("day_", ""), 10);

        // Date create karo
        const dateString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        // IST date for logic
        const checkDate = moment.tz(dateString, "YYYY-MM-DD", "Asia/Kolkata");

        // SAME calendar day ko UTC midnight me convert karo (DB ke liye)
        const dateForDb = moment.utc(checkDate.format("YYYY-MM-DD"), "YYYY-MM-DD").toDate();

        // Check kro ki pehle se attendance entry h ya ni
        const existing = await Attendance.findOne({ teacherId, date: dateForDb, schoolCode });

        if (existing && existing.source === "biometric") {
          // biometric entry → never editable
          continue;
        }

        // CHECK 1: FUTURE DATE BLOCK
        if (checkDate.isAfter(serverToday, 'day')) {
          continue; // Chup-chap ignore kar do future entry ko
        }

        // CHECK 2: PAST EDIT BLOCK
        if (checkDate.isBefore(serverToday, 'day')) {
          // Agar pehle se entry hai -> SKIP karo (Edit mat karne do)
          if (existing) {
            continue;
          }
        }

        // Agar yahan tak aa gaye, matlab sab sahi hai. Save kar do.
        await Attendance.findOneAndUpdate(
          { teacherId, date: dateForDb, schoolCode },
          { status, schoolCode },
          { upsert: true, new: true }
        );
      }
    }

    // --- PAYMENT & EXPENSE LOGIC 
    for (const teacherId in paymentStatus) {
      const newStatus = paymentStatus[teacherId];

      const paidOnDate = newStatus === "paid" ? new Date() : null;

      await SalaryStatus.findOneAndUpdate(
        { teacherId, month: Number(month), year: Number(year), schoolCode },
        { status: newStatus,paidOn: paidOnDate, schoolCode },
        { upsert: true, new: true }
      );

      const uniqueKey = `teacher_${teacherId}_${year}_${month}`;

      if (newStatus === "pending") {
        // Agar status pending ho gaya toh purana Expense delete karo
        await Expense.findOneAndDelete({ uniqueKey, schoolCode });
      }
    }

    // Create expense for all PAID teachers only
    const paidTeachers = await SalaryStatus.find({
      month: Number(month),
      year: Number(year),
      status: "paid",
      schoolCode
    });
    for (let t of paidTeachers) {
      const teacher = await Teacher.findOne({ _id: t.teacherId, schoolCode });


      if (teacher) {
        // ⭐ FIX: Pehle check karo ki is teacher ka is month ka expense pehle se toh nahi bana?
        const uniqueKey = `teacher_${t.teacherId}_${year}_${month}`;
        const existingExpense = await Expense.findOne({ uniqueKey, schoolCode });

        if (!existingExpense) {
          // Agar pehle se expense nahi hai, tabhi naya banao!
          await createSalaryExpense({
            name: teacher.name,
            amount: t.payableSalary || 0,
            month: Number(month),
            year: Number(year),
            personId: t.teacherId,
            role: "teacher",
            schoolCode: schoolCode,
            uniqueKey: uniqueKey // uniqueKey pass karna mat bhoolna agar aapke function me use hoti hai
          });
        } else {
          // (Optional) Agar amount change hua ho toh update kar do
          existingExpense.amount = t.payableSalary || 0;
          await existingExpense.save();
        }
      }
    }

    res.redirect(`/view-attendance-teachers?month=${month}&year=${year}`);

  } catch (err) {
    console.error("Teacher attendance save error:", err);
    res.status(500).send("Unable to save attendance.");
  }
});

// 👉 Update Salary Status (Paid/Pending)
router.post("/update-salary-status/:teacherId", adminAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  try {
    const { teacherId } = req.params;
    let { month, year, status } = req.body;

    month = Number(month);
    year = Number(year);

    await SalaryStatus.findOneAndUpdate(
      { teacherId, month, year, schoolCode },
      { status, paidOn: status === "paid" ? new Date() : null, schoolCode },
      { upsert: true }
    );

    res.redirect(`/view-attendance-teachers?month=${month}&year=${year}`);
  } catch (err) {
    console.error("Salary status update error:", err);
    res.status(500).send("Unable to update salary status.");
  }
});

module.exports = router;

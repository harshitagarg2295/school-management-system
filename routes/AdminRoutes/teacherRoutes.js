const express = require("express");
const router = express.Router();
const moment = require("moment");

const Teacher = require("../../models/TeacherSchema");
const Attendance = require("../../models/TeacherAttendance");
const Holiday = require("../../models/Holiday");
const SalaryStatus = require("../../models/TeacherSalaryStatus");
const AdminNotification = require("../../models/AdminNotificationSchema");
const Expense = require("../../models/Expense");
const createSalaryExpense = require("../../utils/createSalaryExpense");
const { adminAuth } = require("../../middlewares/auth");
const bcrypt = require("bcrypt");


// List all teachers
router.get("/teach-menu", adminAuth, async (req, res) => {

  const admin = await AdminNotification.findOne() || { notifications: [] };
  const teachers = await Teacher.find().sort({ name: 1 });
  res.render("Admin/teachers_list", { teachers, admin });
});

// Add teacher
router.post("/add-teacher", async (req, res) => {
  const toTitleCase = str => str.replace(/\w\S*/g, txt =>
    txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );

  const { name, empId, subject, salary, address, phone, class: className } = req.body;

  // Example logic: username = first 3 letters of name (lowercase) + @ +  987
  // password = first 2 letters of name  + @ + last 3 digits of mobile

  const username = name.slice(0, 3).toLowerCase() + "@" + 987;
  const rawPassword = name.slice(0, 2).toLowerCase() + "@" + phone.toString().slice(-3);

  // 🔐 HASH PASSWORD (IMPORTANT) store password in secure form
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  const teacher = new Teacher({
    name: toTitleCase(name),
    empId,
    subject: toTitleCase(subject),
    class: className.toUpperCase(),
    address: toTitleCase(address),
    salary,
    phone,
    username,
    password: hashedPassword
  });

  await teacher.save();
  res.redirect("/teach-menu");
});

// Delete teacher
router.post("/delete-teacher/:id", async (req, res) => {
  await Teacher.findByIdAndDelete(req.params.id);
  res.redirect("/teach-menu");
});

// Edit teacher
router.post("/edit-teacher/:id", async (req, res) => {
  const toTitleCase = str => str.replace(/\w\S*/g, txt =>
    txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );

  const { name, empId, subject, class: className, salary, address, phone } = req.body;

  await Teacher.findByIdAndUpdate(req.params.id, {
    name: toTitleCase(name),
    empId,
    subject: toTitleCase(subject),
    class: className.toUpperCase(),
    address: toTitleCase(address),
    salary,
    phone
  });

  res.redirect("/teach-menu");
});


// 👉 Declare Holiday (for teachers)
router.post("/mark-teacher-holiday", async (req, res) => {
  const { date, reason } = req.body;
  let holidayDate = moment.utc(date, "YYYY-MM-DD").startOf("day").toDate();

  let existing = await Holiday.findOne({ date: holidayDate, role: "teacher" });
  if (existing) {
    existing.reason = reason;
    await existing.save();
  } else {
    await Holiday.create({ role: "teacher", date: holidayDate, reason });
  }
  res.redirect("/view-attendance-teachers");
});


// 👉 View Attendance Page
router.get("/view-attendance-teachers", adminAuth, async (req, res) => {
  try {
    const teachers = await Teacher.find().sort({ name: 1 });

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
      let presentDays = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const status = attendance["day_" + day];

        if (status === "A" && !sundays.includes(day) && !holidayDates.includes(day)) {
          absentDays++;
        }
        if (status === "L" && !sundays.includes(day) && !holidayDates.includes(day)) {
          lateCount++;
        }
        if (status === "P" || status === "L") presentDays++;
      }

      // हर 2 leave = 1 absent
      const totalAbsent = absentDays + Math.floor(lateCount / 2);

      // const totalSalary = teacher.salary - absentDays * dailySalary;

      const deduction = totalAbsent * dailySalary;
      const payableSalary = teacher.salary - deduction;

      // Fetch salary status for this teacher, month, year
      let statusDoc = await SalaryStatus.findOne({
        teacherId: teacher._id,
        month,
        year,
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
          status: "pending"
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
router.post("/submit-attendance-teachers", async (req, res) => {
  let { attendance = {}, paymentStatus = {}, month, year } = req.body;

  // 1. Server ka Time nikal lo (India Timezone handle karke)
  // Isse device ki date change karne se koi fark nahi padega
  const serverToday = moment().utcOffset("+05:30").startOf('day'); // India ka Aaj ka 12:00 AM

  try {
    for (const teacherId in attendance) {
      const daily = attendance[teacherId];

      for (const dayKey in daily) {
        const status = daily[dayKey];
        if (!["P", "A", "L"].includes(status)) continue;

        const day = parseInt(dayKey.replace("day_", ""), 10);

        // Date create karo
        const dateString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const dateForDb = moment.utc(dateString, "YYYY-MM-DD").toDate();

        // Moment object for comparison
        const checkDate = moment(dateString, "YYYY-MM-DD");

        // Check kro ki pehle se attendance entry h ya ni
        const existing = await Attendance.findOne({ teacherId, date: dateForDb });

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
          { teacherId, date: dateForDb },
          { status: status },
          { upsert: true, new: true }
        );
      }
    }

    // --- PAYMENT & EXPENSE LOGIC 
    for (const teacherId in paymentStatus) {
      const newStatus = paymentStatus[teacherId];

      await SalaryStatus.findOneAndUpdate(
        { teacherId, month, year },
        { status: newStatus },
        { upsert: true }
      );

      if (newStatus === "pending") {
        const uniqueKey = `teacher_${teacherId}_${year}_${month}`;
        await Expense.findOneAndDelete({ uniqueKey });
      }
    }

    // Create expense for all PAID teachers only
    const paidTeachers = await SalaryStatus.find({ month, year, status: "paid" });
    for (let t of paidTeachers) {
      const teacher = await Teacher.findById(t.teacherId);
      await createSalaryExpense({
        name: teacher.name,
        amount: t.payableSalary,
        month: Number(month),
        year: Number(year),
        personId: t.teacherId,
        role: "teacher"
      });
    }

    res.redirect(`/view-attendance-teachers?month=${month}&year=${year}`);

  } catch (err) {
    console.error("Teacher attendance save error:", err);
    res.status(500).send("Unable to save attendance.");
  }
});

// 👉 Update Salary Status (Paid/Pending)
router.post("/update-salary-status/:teacherId", async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { month, year, status } = req.body;

    month = Number(month);
    year = Number(year);

    await SalaryStatus.findOneAndUpdate(
      { teacherId, month, year },
      { status, paidOn: status === "paid" ? new Date() : null },
      { upsert: true }
    );

    res.redirect(`/view-attendance-teachers?month=${month}&year=${year}`);
  } catch (err) {
    console.error("Salary status update error:", err);
    res.status(500).send("Unable to update salary status.");
  }
});

module.exports = router;

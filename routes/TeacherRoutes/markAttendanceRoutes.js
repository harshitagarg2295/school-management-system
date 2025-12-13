
const express = require('express');
const router = express.Router();
const Teacher = require('../../models/TeacherSchema');
const Student = require('../../models/StudentSchema');
const Holiday = require("../../models/Holiday");
const Attendance = require("../../models/StudentAttendance");
const moment = require("moment");
const {teacherAuth} =  require("../../middlewares/auth");


// POST - Mark Holiday for Students
router.post("/teachers/mark-holiday", async (req, res) => {

    const { date, reason } = req.body;

    let existing = await Holiday.findOne({ date: new Date(date), role: "student" });
    if (existing) {
        existing.reason = reason;
        await existing.save();
    } else {
        await Holiday.create({ role: "student", date: new Date(date), reason });
    }

    res.redirect("/teachers/mark-attendance");
});

// GET - Teacher mark attendance page
router.get("/teachers/mark-attendance", teacherAuth,async (req, res) => {
    try {
        const teacherId = req.session.teacherId;
        if (!teacherId) return res.redirect("/teacher.html");

        const teacher = await Teacher.findById(teacherId);

        // Not a class teacher
        if (!teacher || teacher.classTeacher !== "yes" || !teacher.assignedClass) {
            return res.send("You are not a class teacher");
        }

        // Fetch students of assigned class
        const students = await Student.find({ class: teacher.assignedClass }).sort({ name: 1 });

        const month = req.query.month || moment().format("MM");
        const year = req.query.year || moment().format("YYYY");

        const startOfMonth = moment.utc(`${year}-${month}-01`, "YYYY-MM-DD").startOf("day").toDate();
        const endOfMonth = moment.utc(startOfMonth).endOf("month").toDate();
        const daysInMonth = moment(`${year}-${month}`, "YYYY-MM").daysInMonth();

        // Sundays in this month
        const sundays = [];
        for (let i = 1; i <= daysInMonth; i++) {
            const date = moment.utc(`${year}-${month}-${i}`, "YYYY-MM-DD");
            if (date.day() === 0) sundays.push(i);
        }

        // Holidays for students
        const allHolidays = await Holiday.find({
            role: "student",
            date: { $gte: startOfMonth, $lte: endOfMonth }
        });

        const holidayReasons = {};
        allHolidays.forEach(h => {
            holidayReasons[moment.utc(h.date).date()] = h.reason;
        });

        const holidayDates = allHolidays.map(h => moment.utc(h.date).date());

        // Attendance records
        const attendanceData = await Attendance.find({
            studentId: { $in: students.map(s => s._id) },
            date: { $gte: startOfMonth, $lte: endOfMonth }
        });

        const attendanceMap = {};
        attendanceData.forEach(a => {
            const day = moment.utc(a.date).date();
            const sid = a.studentId.toString();
            if (!attendanceMap[sid]) attendanceMap[sid] = {};
            attendanceMap[sid]['day_' + day] = a.status;
        });

        const today = parseInt(moment().format("D"));

        res.render("markAttendance", {
            teacher,
            students,
            month,
            year,
            daysInMonth,
            sundays,
            holidays: holidayDates,
            holidayReasons,
            moment,
            attendanceMap,
            today
        });

    } catch (err) {
        console.error("Error in GET /teachers/mark-attendance:", err);
        res.status(500).send("Something went wrong");
    }
});

// POST - Save Attendance for Teacher’s class
// 👉 Teacher Submit Student Attendance (SECURE VERSION)
router.post("/teachers/submit-students-attendance", async (req, res) => {
    const teacherId = req.session.teacherId;
    const teacher = await Teacher.findById(teacherId);

    // Permission Check
    if (!teacher || teacher.classTeacher !== "yes" || !teacher.assignedClass) {
        return res.send("You are not a class teacher");
    }

    // Default empty object taaki crash na ho
    const { attendance = {}, month, year } = req.body;

    // 1. Server Time (India)
    const serverToday = moment().utcOffset("+05:30").startOf('day');

    try {
        for (let studentId in attendance) {
            const daily = attendance[studentId]; // { day_1: "P", day_2: "A", ... }

            for (let dayKey in daily) {
                const status = daily[dayKey];
                
                // Sirf Valid Status (P ya A) hi process karo
                if (status !== "P" && status !== "A") continue;

                const day = parseInt(dayKey.replace("day_", ""), 10);
                
                // Safe Date String Creation (Ensure String type for padStart)
                const dateString = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                
                // DB ke liye Date Object
                const dateForDb = moment.utc(dateString, "YYYY-MM-DD").toDate();
                
                // Comparison ke liye Moment Object
                const checkDate = moment(dateString, "YYYY-MM-DD");

                // --- 🛑 STRICT CHECKS ---

                // CASE 1: FUTURE DATE -> Ignore
                if (checkDate.isAfter(serverToday, 'day')) {
                    continue; 
                }

                // CASE 2: PAST EDIT -> Ignore (Agar pehle se marked hai)
                if (checkDate.isBefore(serverToday, 'day')) {
                    const existing = await Attendance.findOne({ studentId: studentId, date: dateForDb });
                    if (existing) {
                        continue; // Edit allow nahi hai, purana hi rehne do
                    }
                }

                // --- SAVE TO DB (Direct Update) ---
                await Attendance.findOneAndUpdate(
                    { studentId: studentId, date: dateForDb },
                    { status: status },
                    { upsert: true, new: true }
                );
            }
        }

        res.redirect(`/teachers/mark-attendance?month=${month}&year=${year}`);

    } catch (err) {
        console.error("Error saving attendance:", err);
        res.status(500).send("Something went wrong.");
    }
});

module.exports = router;

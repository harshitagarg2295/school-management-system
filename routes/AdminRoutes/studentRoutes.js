const express = require("express");
const router = express.Router();
const Student = require("../../models/StudentSchema");
const AdminNotification = require("../../models/AdminNotificationSchema");
const { adminAuth } =  require("../../middlewares/auth");
const bcrypt = require("bcrypt")

// POST - Mark Holiday for Students
router.post("/mark-student-holiday", async (req, res) => {

    const { date, reason } = req.body;

    let existing = await Holiday.findOne({ date: new Date(date), role: "student" });
    if (existing) {
        existing.reason = reason;
        await existing.save();
    } else {
        await Holiday.create({ role: "student", date: new Date(date), reason });
    }

    res.redirect("/view-attendance-students");
});

router.get("/stud-menu",adminAuth, async (req, res) => {
    const classFilter = req.query.classFilter;

    let filter = {};
    if (classFilter) {
        filter.class = classFilter;
    }

    const students = await Student.find(filter).sort({ name: 1 });

    // ✅ Dynamically extract all unique classes from DB
    const classList = await Student.distinct("class");

    const admin = await AdminNotification.findOne() || { notifications: [] };


    res.render("Admin/students_list", {
        students,
        classFilter,
        allClasses: classList.sort(),
        admin
    });
});

router.post("/add-student", async (req, res) => { //add student

    function toTitleCase(str) {
        return str.replace(/\w\S*/g, (txt) => {
            return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase();
        });
    }

    const { name, id, class: studentClass, DOB, fees, phone, address } = req.body;


    const dobDate = new Date(DOB); // convert string to date object


    //username = first 3 letters of name (lowercase) + @ + birth date (dd) no leading zeroes
    // password = full DOB (yyyymmdd) + @ + student id 

    const username = name.slice(0, 3).toLowerCase() + "@" + dobDate.getDate();

    const rawPassword = DOB.replace(/-/g, "") + "@" + id.toString();

      // 🔐 HASH PASSWORD (IMPORTANT) store password in secure form
      const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const totalFees = parseInt(req.body.fees);
    const installmentAmount = Math.round(totalFees / 4);

    const feeStatusArray = [
        {
            feeType: "Admission Fee",
            installment: "One-time",
            amount: 1500,
            status: "Pending"
        },
        {
            feeType: "April",
            installment: "1st",
            amount: installmentAmount,
            status: "Pending"
        },
        {
            feeType: "September",
            installment: "2nd",
            amount: installmentAmount,
            status: "Pending"
        },
        {
            feeType: "December",
            installment: "3rd",
            amount: installmentAmount,
            status: "Pending"
        },
        {
            feeType: "February",
            installment: "4th",
            amount: installmentAmount,
            status: "Pending"
        }
    ];

    const student = new Student({
        name: toTitleCase(name),
        id: id,
        class: studentClass.toUpperCase(),
        address: toTitleCase(address),
        DOB: dobDate,
        fees: totalFees,
        phone: phone,
        feeStatus: feeStatusArray,
        username,
        password : hashedPassword 
    });



    await student.save();
    res.redirect("/stud-menu");
});

// Delete student route
router.post("/delete-student/:id", async (req, res) => {
    const studentId = req.params.id;
    await Student.findByIdAndDelete(studentId);
    res.redirect("/stud-menu");
});


//  EDIT POST Route (to update data)

function toTitleCase(str) {
    return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase();
    });
}

router.post("/edit-student/:id", async (req, res) => {
    const { name, id, class: className, DOB, fees, address, phone } = req.body;

    const dobDate = new Date(DOB);

    await Student.findByIdAndUpdate(req.params.id, {
        name: toTitleCase(name),
        id: toTitleCase(id),
        class: className.toUpperCase(),
        address: toTitleCase(address),
        DOB: dobDate,
        fees,
        phone
    });
    res.redirect("/stud-menu");
});

// Attandance for students + holidays

const moment = require("moment"); //JavaScript date/time library 

const Holiday = require("../../models/Holiday");
const Attendance = require("../../models/StudentAttendance");


router.get("/view-attendance-students", adminAuth, async (req, res) => {
    const classFilter = req.query.classFilter || "";
    const allClasses = await Student.distinct("class");

    const studentQuery = classFilter ? { class: classFilter } : {};
    const students = await Student.find(studentQuery).sort({ name: 1 });

    const month = req.query.month || moment().format("MM");
    const year = req.query.year || moment().format("YYYY");

    const startOfMonth = moment.utc(`${year}-${month}-01`, "YYYY-MM-DD").startOf('day').toDate();
    const endOfMonth = moment.utc(startOfMonth).endOf('month').toDate();

    const daysInMonth = moment(`${year}-${month}`, "YYYY-MM").daysInMonth();

    const sundays = [];
    for (let i = 1; i <= daysInMonth; i++) {
        const date = moment.utc(`${year}-${month}-${i}`, "YYYY-MM-DD");
        if (date.day() === 0) sundays.push(i);
    }

    // Load declared holidays only for students
    const allHolidays = await Holiday.find({
        role: "student",
        date: { $gte: startOfMonth, $lte: endOfMonth }
    });

    // Show holiday reason
    const holidayReasons = {};
    allHolidays.forEach(h => {
        holidayReasons[moment.utc(h.date).date()] = h.reason;
    });

    const holidayDates = allHolidays.map(h => moment.utc(h.date).date());

    const attendanceData = await Attendance.find({
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

    res.render("Admin/view_student_attendance", {
        students,
        classFilter,
        allClasses: allClasses.sort(),
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
});


// saving attendance data in DB

// 👉 Submit Attendance Students (SECURE VERSION)
router.post("/submit-attendance-students", async (req, res) => {
    // Default value {} di hai taaki crash na ho agar empty aaye
    let { attendance = {}, month, year } = req.body;

    // 1. Server Time (India) - Cheating rokne ke liye
    const serverToday = moment().utcOffset("+05:30").startOf('day'); 

    try {
        for (let studentId in attendance) {
            const daily = attendance[studentId]; 

            for (let dayKey in daily) {
                const status = daily[dayKey];
                
                // Sirf Valid Status (P ya A) hi process karo
                if (status !== "P" && status !== "A") continue;

                const day = parseInt(dayKey.replace('day_', ''), 10);
                
                // Date format string: "YYYY-MM-DD"
                // String(year) ensure karta hai ki agar number ho to bhi string bane
                const dateString = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                
                // DB ke liye Date Object
                const dateForDb = moment.utc(dateString, "YYYY-MM-DD").toDate();
                
                // Comparison ke liye Moment Object
                const checkDate = moment(dateString, "YYYY-MM-DD");

                // --- STRICT CHECKS

                // CASE 1: FUTURE DATE -> Ignore
                if (checkDate.isAfter(serverToday, 'day')) {
                    continue; 
                }

                // CASE 2: PAST EDIT -> Ignore (Agar pehle se marked hai)
                if (checkDate.isBefore(serverToday, 'day')) {
                    const existing = await Attendance.findOne({ studentId: studentId, date: dateForDb });
                    if (existing) {
                        continue; // Edit allow nahi hai
                    }
                }

                // --- SAVE TO DB (Direct) ---
                await Attendance.findOneAndUpdate(
                    { studentId: studentId, date: dateForDb },
                    { status: status },
                    { upsert: true, new: true }
                );
            }
        }

        res.redirect(`/view-attendance-students?month=${month}&year=${year}`);

    } catch (err) {
        console.error("Error saving student attendance:", err);
        res.status(500).send("Something went wrong.");
    }
});

module.exports = router;
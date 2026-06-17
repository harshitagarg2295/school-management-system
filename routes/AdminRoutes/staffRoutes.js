const express = require("express");
const router = express.Router();
const moment = require("moment-timezone");

const Staff = require("../../models/StaffSchema");
const Attendance = require("../../models/StaffAttendance");
const Holiday = require("../../models/Holiday");
const AdminNotification = require("../../models/AdminNotificationSchema");
const Expense = require("../../models/Expense");
const createSalaryExpense = require("../../utils/createSalaryExpense");
const { adminAuth } = require("../../middlewares/auth");
const { cloudinary } = require("../../config/cloudinaryConfig");


// List all staffs
router.get("/staff-menu", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        const admin = await AdminNotification.findOne({ schoolCode }) || { notifications: [] };
        const staffs = await Staff.find({ schoolCode }).sort({ name: 1 });
        res.render("Admin/staffs_list", { staffs, admin });
    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});

const toTitleCase = (str) => {
    if (!str) return "";
    return str.replace(/\w\S*/g, txt =>
        txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
    );
};

// Add staff
router.post("/add-staff", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;

        const { name, empId, category, salary, address, phone,gender } = req.body;

        const testaff = new Staff({
            name: toTitleCase(name),
            category: toTitleCase(category),
            address: toTitleCase(address),
            salary: salary,
            phone: phone,
            empId: empId?.toUpperCase() || "",
            schoolCode,
            gender
        });

        const savedStaff = await testaff.save();
        return res.redirect(`/staff/${savedStaff._id}`);
    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});

// Delete staff
router.post("/delete-staff/:id", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        await Staff.findOneAndDelete({
            _id: req.params.id,
            schoolCode
        });
        res.redirect("/staff-menu");
    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});

router.get("/staff/:id", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;

        const staff = await Staff.findOne({
            _id: req.params.id,
            schoolCode
        });

        if (!staff) {
            return res.send("Staff not found");
        }

        res.render("Admin/staffProfile", { staff });

    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});

// Edit staff
router.post("/edit-staff/:id", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;

        const updateData = {};

        // 🔥 clean category first
        let category = (req.body.category || "").trim().toLowerCase();

        if (category) {
            updateData.category =
                category.charAt(0).toUpperCase() + category.slice(1);
        }

        if (req.body.name) updateData.name = toTitleCase(req.body.name);
        if (req.body.empId) updateData.empId = req.body.empId.trim().toUpperCase();
        if (req.body.phone) updateData.phone = req.body.phone;
         if (req.body.gender) updateData.gender = req.body.gender;
        if (req.body.salary) updateData.salary = req.body.salary;
        if (req.body.address) updateData.address = toTitleCase(req.body.address);
        if (req.body.education) updateData.education = req.body.education;
        if (req.body.experience) updateData.experience = req.body.experience;
        if (req.body.joiningDate) updateData.joiningDate = req.body.joiningDate;

        // 🔥 driver logic
        if (category === "driver") {
            if (req.body.vehicle) updateData.vehicle = req.body.vehicle;
            if (req.body.vehicleNo) updateData.vehicleNo = req.body.vehicleNo;
        } else {
            updateData.vehicle = null;
            updateData.vehicleNo = null;
        }

        await Staff.findOneAndUpdate(
            { _id: req.params.id, schoolCode },
            { $set: updateData }
        );

        res.redirect(`/staff/${req.params.id}`);
    } catch (err) {
        console.error("Update Error:", err);
        return res.status(500).render("HomePage/500");
    }
});

// Upload image
router.post("/staff/upload-image/:id", adminAuth, async (req, res) => {
    try {
        const base64 = req.body.croppedImage;

        // Agar image data nahi mila toh wapas bhej do
        if (!base64 || base64.trim() === "") {
            return res.redirect(`/staff/${req.params.id}`);
        }

        // 🔒 Secure check: Ensure staff belongs to the logged-in admin's school
        const staff = await Staff.findOne({
            _id: req.params.id,
            schoolCode: req.session.schoolCode
        });

        if (!staff) {
            return res.status(404).send("Staff not found or unauthorized");
        }

        // 🔥 CLOUDINARY UPLOAD (Directly uploading base64 string)
        const uploadResponse = await cloudinary.uploader.upload(base64, {
            folder: "School_Management_Profiles/Staff",
            resource_type: "image"
        });

        // 🔄 Save the online secure_url directly to the database
        await Staff.findOneAndUpdate(
            { _id: req.params.id, schoolCode: req.session.schoolCode },
            { photo: uploadResponse.secure_url }
        );

        res.redirect(`/staff/${req.params.id}`);

    } catch (err) {
        console.error("Error uploading staff image to Cloudinary:", err);
        return res.status(500).render("HomePage/500");
    }
});


// 👉 Declare Holiday (for tseaff)
router.post("/mark-staff-holiday", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        const { date, reason } = req.body;
        let holidayDate = moment.utc(date, "YYYY-MM-DD").startOf("day").toDate();

        let existing = await Holiday.findOne({ date: holidayDate, role: "staff", schoolCode });
        if (existing) {
            existing.reason = reason;
            await existing.save();
        } else {
            await Holiday.create({ role: "staff", date: holidayDate, reason, schoolCode });
        }
        res.redirect("/view-attendance-staffs");
    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});


// 👉 View Attendance Page
router.get("/view-attendance-staffs", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        const staffs = await Staff.find({ schoolCode }).sort({ name: 1 });

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
            role: "staff",
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
            const sid = a.staffId.toString();
            if (!attendanceMap[sid]) attendanceMap[sid] = {};
            attendanceMap[sid]["day_" + day] = a.status;
        });

        // Salary Calculation
        const salaryData = {};

        const monthKey = String(month);
        const yearKey = String(year);


        for (let staff of staffs) {
            const tid = staff._id.toString();
            const dailySalary = Math.round(staff.salary / daysInMonth);
            const attendance = attendanceMap[tid] || {};

            let absentDays = 0;
            let lateCount = 0;
            let paidDays = 0;
            let hasAttendanceData = false; // Check: kya attendance bhari gayi hai?

            // 🔥 FIX 1: Pata karo loop kahan tak chalana hai (Current month me sirf aaj tak)
            const currentMoment = moment();
            let loopUpToDay = daysInMonth;

            if (month === parseInt(currentMoment.format("MM")) && year === parseInt(currentMoment.format("YYYY"))) {
                loopUpToDay = parseInt(currentMoment.format("D"));
            }

            // First Pass: Check data existence
            for (let day = 1; day <= loopUpToDay; day++) {
                const status = attendance["day_" + day];
                if (status === "P" || status === "A" || status === "L") {
                    hasAttendanceData = true;
                    break;
                }
            }

            // Second Pass: Safe Calculation
            if (hasAttendanceData) {
                for (let day = 1; day <= loopUpToDay; day++) {
                    const status = attendance["day_" + day];
                    const isSundayOrHoliday = sundays.includes(day) || holidayDates.includes(day);

                    if (isSundayOrHoliday) {
                        if (status !== "A") {
                            paidDays++; // Sunday/Holiday salary added
                        } else {
                            absentDays++;
                        }
                    } else {
                        if (status === "P" || status === "L") {
                            paidDays++;
                        } else if (status === "A") {
                            absentDays++;
                        }
                    }

                    if (status === "L" && !isSundayOrHoliday) {
                        lateCount++;
                    }
                }
            }

            // 🔥 FIX 2: 2 Late = 1 Absent Calculation
            const lateDeductionDays = Math.floor(lateCount / 2);
            const totalAbsent = absentDays + lateDeductionDays;

            let finalWorkingDays = hasAttendanceData ? (paidDays - lateDeductionDays) : 0;
            if (finalWorkingDays < 0) finalWorkingDays = 0;
            if (finalWorkingDays > daysInMonth) finalWorkingDays = daysInMonth;

            // Final Calculations
            const payableSalary = hasAttendanceData ? Math.round(finalWorkingDays * dailySalary) : 0;
            const deduction = hasAttendanceData ? Math.round(totalAbsent * dailySalary) : 0;

            // Present days count for screen layout
            let presentDays = 0;
            for (let day = 1; day <= daysInMonth; day++) {
                if (attendance["day_" + day] === "P" || attendance["day_" + day] === "L") presentDays++;
            }

            const yearMap = staff.salaryStatus ? staff.salaryStatus.get(yearKey) : null;
            const paymentStatus = (yearMap && yearMap.get(monthKey)) || 'pending';

            salaryData[tid] = {
                absentDays,
                presentDays,
                lateCount,
                totalAbsent,
                dailySalary,
                totalSalary: staff.salary,
                payableSalary,
                deduction,
                status: paymentStatus
            };

        }

        const today = parseInt(moment().format("D"));

        res.render("Admin/view_staff_attendance", {
            staffs,
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
        console.error("Error in /view-attendance-staffs:", err);
        return res.status(500).render("HomePage/500");
    }
});

// 👉 Submit Attendance & Manage Salary / Expense
router.post("/submit-attendance-staffs", adminAuth, async (req, res) => {
    const schoolCode = req.session.schoolCode;
    let { attendance = {}, paymentStatus = {}, month, year } = req.body;

    month = Number(month);
    year = Number(year);

    const monthKey = String(month);
    const yearKey = String(year);
    const serverToday = moment.tz("Asia/Kolkata").startOf("day");

    try {
        // --- 1. ATTENDANCE LOGIC START ---
        for (const staffId in attendance) {
            const daily = attendance[staffId];

            for (const dayKey in daily) {
                const status = daily[dayKey];
                if (!["P", "A", "L"].includes(status)) continue;

                const day = parseInt(dayKey.replace("day_", ""), 10);
                const dateString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const checkDate = moment.tz(dateString, "YYYY-MM-DD", "Asia/Kolkata");
                const dateForDb = moment.utc(checkDate.format("YYYY-MM-DD"), "YYYY-MM-DD").toDate();

                const existing = await Attendance.findOne({ staffId, date: dateForDb, schoolCode });

                if (existing && existing.source === "biometric") continue;
                if (checkDate.isAfter(serverToday, 'day')) continue;
                if (checkDate.isBefore(serverToday, 'day') && existing) continue;

                await Attendance.findOneAndUpdate(
                    { staffId, date: dateForDb, schoolCode },
                    { status: status, schoolCode },
                    { upsert: true, new: true }
                );
            }
        }

        // --- 2. SAVE PAYMENT STATUS & CLEAN PENDING EXPENSES ---
        for (const staffId in paymentStatus) {
            const newStatus = paymentStatus[staffId];

            await Staff.findByIdAndUpdate(staffId, {
                $set: { [`salaryStatus.${yearKey}.${monthKey}`]: newStatus }
            });

            if (newStatus === "pending") {
                const uniqueKey = `staff_${staffId}_${year}_${month}`;
                await Expense.findOneAndDelete({ uniqueKey, schoolCode });
            }
        }

        // --- 3. EXACT SALARY CALCULATION WITH LATE COUNT & HOLIDAYS ---
        const staffList = await Staff.find({ schoolCode });
        const daysInMonth = moment(`${year}-${month}`, "YYYY-MM").daysInMonth();

        const startOfMonth = moment.utc(`${year}-${month}-01`, "YYYY-MM-DD").startOf("day").toDate();
        const endOfMonth = moment.utc(startOfMonth).endOf("month").toDate();

        // Target Sundays
        const sundays = [];
        for (let i = 1; i <= daysInMonth; i++) {
            const date = moment.utc(`${year}-${month}-${i}`, "YYYY-MM-DD");
            if (date.day() === 0) sundays.push(i);
        }

        // Target Holidays (Role Filter Added)
        const allHolidays = await Holiday.find({
            role: "staff",
            schoolCode,
            date: { $gte: startOfMonth, $lte: endOfMonth },
        });
        const holidayDates = allHolidays.map(h => moment.utc(h.date).date());

        // Fetch All Attendance for this month
        const attendanceData = await Attendance.find({
            schoolCode,
            date: { $gte: startOfMonth, $lte: endOfMonth },
        });

        const attendanceMap = {};
        attendanceData.forEach(a => {
            const day = moment.utc(a.date).date();
            const sid = a.staffId.toString();
            if (!attendanceMap[sid]) attendanceMap[sid] = {};
            attendanceMap[sid]["day_" + day] = a.status;
        });

        const currentMoment = moment();
        let loopUpToDay = daysInMonth;
        if (month === parseInt(currentMoment.format("MM")) && year === parseInt(currentMoment.format("YYYY"))) {
            loopUpToDay = parseInt(currentMoment.format("D"));
        }

        for (let s of staffList) {
            const currentStatus = s.salaryStatus?.get(yearKey)?.get(monthKey) || "pending";

            if (currentStatus === "paid") {
                const tid = s._id.toString();
                const attendance = attendanceMap[tid] || {};
                const dailySalary = Math.round(s.salary / daysInMonth);

                let absentDays = 0;
                let lateCount = 0;
                let paidDays = 0;
                let hasAttendanceData = false;

                // Loop setup (Checking if data exists up to today)
                for (let day = 1; day <= loopUpToDay; day++) {
                    const status = attendance["day_" + day];
                    if (status === "P" || status === "A" || status === "L") {
                        hasAttendanceData = true;
                        break;
                    }
                }

                if (hasAttendanceData) {
                    for (let day = 1; day <= loopUpToDay; day++) {
                        const status = attendance["day_" + day];
                        const isSundayOrHoliday = sundays.includes(day) || holidayDates.includes(day);

                        if (isSundayOrHoliday) {
                            if (status !== "A") paidDays++;
                            else absentDays++;
                        } else {
                            if (status === "P" || status === "L") paidDays++;
                            else if (status === "A") absentDays++;
                        }

                        if (status === "L" && !isSundayOrHoliday) lateCount++;
                    }
                }

                const lateDeductionDays = Math.floor(lateCount / 2);
                let finalWorkingDays = hasAttendanceData ? (paidDays - lateDeductionDays) : 0;

                if (finalWorkingDays < 0) finalWorkingDays = 0;
                if (finalWorkingDays > daysInMonth) finalWorkingDays = daysInMonth;

                const payableSalary = hasAttendanceData ? Math.round(finalWorkingDays * dailySalary) : 0;

                await createSalaryExpense({
                    name: s.name,
                    amount: payableSalary,
                    month,
                    year,
                    personId: s._id,
                    role: "staff",
                    schoolCode
                });
            }
        }

        res.redirect(`/view-attendance-staffs?month=${month}&year=${year}`);

    } catch (err) {
        console.error("Staff attendance save error:", err);
        return res.status(500).render("HomePage/500");
    }
});

// 👉 Update Staff Salary Status Single Row (FIXED)
router.post("/update-staff-salary/:staffId", adminAuth, async (req, res) => {
    const schoolCode = req.session.schoolCode;
    const { staffId } = req.params;

    let { month, year, status } = req.body;
    month = Number(month);
    year = Number(year);

    try {
        await Staff.findOneAndUpdate(
            { _id: staffId, schoolCode },
            { $set: { [`salaryStatus.${year}.${month}`]: status } }
        );

        if (status === "pending") {
            const uniqueKey = `staff_${staffId}_${year}_${month}`;
            await Expense.findOneAndDelete({ uniqueKey, schoolCode });
        } else if (status === "paid") {
            const s = await Staff.findOne({ _id: staffId, schoolCode });
            if (s) {
                const daysInMonth = moment(`${year}-${month}`, "YYYY-MM").daysInMonth();
                const startOfMonth = moment.utc(`${year}-${month}-01`, "YYYY-MM-DD").startOf("day").toDate();
                const endOfMonth = moment.utc(startOfMonth).endOf("month").toDate();

                const sundays = [];
                for (let i = 1; i <= daysInMonth; i++) {
                    const date = moment.utc(`${year}-${month}-${i}`, "YYYY-MM-DD");
                    if (date.day() === 0) sundays.push(i);
                }

                const allHolidays = await Holiday.find({
                    role: "staff",
                    schoolCode,
                    date: { $gte: startOfMonth, $lte: endOfMonth },
                });
                const holidayDates = allHolidays.map(h => moment.utc(h.date).date());

                const attendanceData = await Attendance.find({
                    staffId: s._id,
                    schoolCode,
                    date: { $gte: startOfMonth, $lte: endOfMonth },
                });

                const attendance = {};
                attendanceData.forEach(a => {
                    const day = moment.utc(a.date).date();
                    attendance["day_" + day] = a.status;
                });

                // 🔥 FIX: Single row route calculation loop sync
                const currentMoment = moment();
                let loopUpToDay = daysInMonth;
                if (month === parseInt(currentMoment.format("MM")) && year === parseInt(currentMoment.format("YYYY"))) {
                    loopUpToDay = parseInt(currentMoment.format("D"));
                }

                const dailySalary = Math.round(s.salary / daysInMonth);
                let absentDays = 0;
                let lateCount = 0;
                let paidDays = 0;
                let hasAttendanceData = false;

                for (let day = 1; day <= loopUpToDay; day++) {
                    const status = attendance["day_" + day];
                    if (status === "P" || status === "A" || status === "L") {
                        hasAttendanceData = true;
                        break;
                    }
                }

                if (hasAttendanceData) {
                    for (let day = 1; day <= loopUpToDay; day++) {
                        const status = attendance["day_" + day];
                        const isSundayOrHoliday = sundays.includes(day) || holidayDates.includes(day);

                        if (isSundayOrHoliday) {
                            if (status !== "A") paidDays++;
                            else absentDays++;
                        } else {
                            if (status === "P" || status === "L") paidDays++;
                            else if (status === "A") absentDays++;
                        }

                        if (status === "L" && !isSundayOrHoliday) lateCount++;
                    }
                }

                const lateDeductionDays = Math.floor(lateCount / 2);
                let finalWorkingDays = hasAttendanceData ? (paidDays - lateDeductionDays) : 0;

                if (finalWorkingDays < 0) finalWorkingDays = 0;
                if (finalWorkingDays > daysInMonth) finalWorkingDays = daysInMonth;

                const payableSalary = hasAttendanceData ? Math.round(finalWorkingDays * dailySalary) : 0;

                await createSalaryExpense({
                    name: s.name,
                    amount: payableSalary,
                    month,
                    year,
                    personId: s._id,
                    role: "staff",
                    schoolCode
                });
            }
        }

        res.redirect(`/view-attendance-staffs?month=${month}&year=${year}`);
    } catch (error) {
        console.error("Error in single row salary update:", error);
        return res.status(500).render("HomePage/500");

    }
});

module.exports = router;

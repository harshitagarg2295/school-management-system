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
const fs = require("fs");
const path = require("path");


// List all staffs
router.get("/staff-menu", adminAuth, async (req, res) => {
    const schoolCode = req.session.schoolCode;
    const admin = await AdminNotification.findOne({ schoolCode }) || { notifications: [] };
    const staffs = await Staff.find({ schoolCode }).sort({ name: 1 });
    res.render("Admin/staffs_list", { staffs, admin });
});

const toTitleCase = (str) => {
    if (!str) return "";
    return str.replace(/\w\S*/g, txt =>
        txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
    );
};

// Add staff
router.post("/add-staff", adminAuth, async (req, res) => {
    const schoolCode = req.session.schoolCode;

    const { name, empId, category, salary, address, phone } = req.body;

    const testaff = new Staff({
        name: toTitleCase(name),
        category: toTitleCase(category),
        address: toTitleCase(address),
        salary: salary,
        phone: phone,
        empId: empId?.toUpperCase() || "",
        schoolCode
    });

    const savedStaff = await testaff.save();
    return res.redirect(`/staff/${savedStaff._id}`);
});

// Delete staff
router.post("/delete-staff/:id", adminAuth, async (req, res) => {
    const schoolCode = req.session.schoolCode;
    await Staff.findOneAndDelete({
        _id: req.params.id,
        schoolCode
    });
    res.redirect("/staff-menu");
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
        console.log(err);
        res.send("Error loading staff profile");
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
        res.status(500).send("Error updating staff");
    }
});

// Upload image
router.post("/staff/upload-image/:id", adminAuth, async (req, res) => {
    try {
        const base64 = req.body.croppedImage;
        if (!base64) return res.redirect(`/staff/${req.params.id}`);

        const base64Data = base64.split(";base64,").pop();

        const mimeType = base64.match(/data:(image\/\w+);base64/)[1];
        const ext = mimeType.split("/")[1];
        const fileName = Date.now() + "." + ext;

        const uploadDir = path.join(__dirname, "../../uploads/staffs");

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // 🔒 secure fetch
        const staff = await Staff.findOne({
            _id: req.params.id,
            schoolCode: req.session.schoolCode
        });

        // 🧹 delete old image
        if (staff && staff.photo) {
            const oldPath = path.join(uploadDir, staff.photo);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        fs.writeFileSync(path.join(uploadDir, fileName), base64Data, "base64");

        await Staff.findOneAndUpdate(
            { _id: req.params.id, schoolCode: req.session.schoolCode },
            { photo: fileName }
        );

        res.redirect(`/staff/${req.params.id}`);

    } catch (err) {
        console.log(err);
        res.send("Error uploading image");
    }
});


// 👉 Declare Holiday (for tseaff)
router.post("/mark-staff-holiday", adminAuth, async (req, res) => {
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

            // const totalSalary = staff.salary - absentDays * dailySalary;

            const deduction = totalAbsent * dailySalary;
            const payableSalary = staff.salary - deduction;

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
        res.status(500).send("Error loading attendance data.");
    }
});


// 👉 Submit Attendance
router.post("/submit-attendance-staffs", adminAuth, async (req, res) => {
    const schoolCode = req.session.schoolCode;
    let { attendance = {}, paymentStatus = {}, month, year } = req.body;

    // 1. Server Time (India)
    const serverToday = moment.tz("Asia/Kolkata").startOf("day");

    try {
        // --- ATTENDANCE LOGIC START (Updated) ---
        for (const staffId in attendance) {
            const daily = attendance[staffId];

            for (const dayKey in daily) {
                const status = daily[dayKey];

                // Invalid status skip karo
                if (!["P", "A", "L"].includes(status)) continue;

                const day = parseInt(dayKey.replace("day_", ""), 10);

                // Date Creation (Safe Format)
                const dateString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

                // IST date for logic
                const checkDate = moment.tz(dateString, "YYYY-MM-DD", "Asia/Kolkata");

                // SAME calendar day ko UTC midnight me convert karo (DB ke liye)
                const dateForDb = moment.utc(checkDate.format("YYYY-MM-DD"), "YYYY-MM-DD").toDate();

                // Check kro ki pehle se attendance entry h ya ni
                const existing = await Attendance.findOne({ staffId: staffId, date: dateForDb, schoolCode });


                if (existing && existing.source === "biometric") {
                    // biometric entry → never editable
                    continue;
                }

                // --- VALIDATION CHECKS 

                // CHECK 1: FUTURE DATE -> Block
                if (checkDate.isAfter(serverToday, 'day')) {
                    continue; // Future ki date save nahi hogi
                }

                // CHECK 2: PAST EDIT -> Block
                if (checkDate.isBefore(serverToday, 'day')) {
                    // Agar pehle se marked hai, to Edit mat karne do
                    if (existing) {
                        continue;
                    }
                }

                // --- SAVE TO DB (Direct Save) ---
                await Attendance.findOneAndUpdate(
                    { staffId: staffId, date: dateForDb, schoolCode }, // 🔥
                    { status: status, schoolCode },
                    { upsert: true, new: true }
                );
            }
        }

        // --- Save Payment Status + Delete Expense if pending ---

        const monthKey = String(month);
        const yearKey = String(year);

        for (const staffId in paymentStatus) {
            const newStatus = paymentStatus[staffId]; // paid / pending

            // Update status in Staff collection
            await Staff.findByIdAndUpdate(staffId, {
                $set: {
                    [`salaryStatus.${yearKey}.${monthKey}`]: newStatus
                }
            });

            // ❌ DELETE EXPENSE when status becomes pending
            if (newStatus === "pending") {
                const uniqueKey = `staff_${staffId}_${year}_${month}`;
                await Expense.findOneAndDelete({ uniqueKey, schoolCode });
            }
        }

        // --- Create Expense for all PAID staff ---
        const staffList = await Staff.find({ schoolCode });

        for (let s of staffList) {
            const status = s.salaryStatus.get(yearKey)?.get(monthKey) || "pending";

            if (status === "paid") {
                await createSalaryExpense({
                    name: s.name,
                    amount: s.salary,   // or payable salary agar calculate karte ho
                    month,
                    year,
                    personId: s._id,
                    role: "staff"
                });
            }
        }

        res.redirect(`/view-attendance-staffs?month=${month}&year=${year}`);

    } catch (err) {
        console.error("Staff attendance save error:", err);
        res.status(500).send("Unable to save staff attendance.");
    }
});


// 👉 Update Staff Salary Status (NO delete/add here)
router.post("/update-staff-salary/:staffId", adminAuth, async (req, res) => {
    const schoolCode = req.session.schoolCode;
    const { staffId } = req.params;
    const { month, year, status } = req.body;

    await Staff.findOneAndUpdate(
        { _id: staffId, schoolCode },
        {
            $set: {
                [`salaryStatus.${year}.${month}`]: status
            }
        }
    );

    res.redirect(`/view-attendance-staffs?month=${month}&year=${year}`);
});

module.exports = router;

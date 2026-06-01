const express = require("express");
const router = express.Router();
const Student = require("../../models/StudentSchema");
const AdminNotification = require("../../models/AdminNotificationSchema");
const { adminAuth } = require("../../middlewares/auth");
const bcrypt = require("bcrypt")
const moment = require("moment-timezone");
const { cloudinary } = require("../../config/cloudinaryConfig");


// POST - Mark Holiday for Students
router.post("/mark-student-holiday", adminAuth, async (req, res) => {
    try {

        const schoolCode = req.session.schoolCode;
        const { date, reason } = req.body;

        let existing = await Holiday.findOne({ date: new Date(date), role: "student", schoolCode });
        if (existing) {
            existing.reason = reason;
            await existing.save();
        } else {
            await Holiday.create({ role: "student", date: new Date(date), reason, schoolCode });
        }

        res.redirect("/view-attendance-students");
    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});

router.get("/stud-menu", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        const classFilter = req.query.classFilter;

        let filter = { schoolCode };

        if (classFilter) {
            filter.class = classFilter;
        }
        const students = await Student.find(filter).sort({ name: 1 });

        // ✅ Dynamically extract all unique classes from DB
        const classList = await Student.distinct("class", { schoolCode });

        const admin = await AdminNotification.findOne({ schoolCode }) || { notifications: [] };

        res.render("Admin/students_list", {
            students,
            classFilter,
            allClasses: classList.sort(),
            admin
        });
    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});

router.post("/add-student", adminAuth, async (req, res) => { //add student
    try {
        const schoolCode = req.session.schoolCode;
        function toTitleCase(str) {
            if (!str || typeof str !== 'string') return ""; // Agar khali hai to error na de
            return str.replace(/\w\S*/g, (txt) => {
                return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase();
            });
        }

        const {
            name, id, class: studentClass, DOB, fees, phone, address, rollNo, house,
            section, gender, admissionDate, fatherName, motherName,
            initialClass, previousSchool, bloodGroup
        } = req.body;

        const dobDate = new Date(DOB); // convert string to date object


        //username = first 3 letters of name (lowercase) + @ + birth date (dd) no leading zeroes
        // password = full DOB (yyyymmdd) + @ + student id (capital)

        let username;
        let exists = true;

        while (exists) {
            username = name.trim().slice(0, 3).toLowerCase() + "@" + dobDate.getDate() + Math.floor(10 + Math.random() * 90);

            const existingStudent = await Student.findOne({ username, schoolCode });

            if (!existingStudent) {
                exists = false;
            }
        }

        const cleanId = id.trim().toUpperCase();

        const rawPassword = DOB.replace(/-/g, "") + "@" + cleanId;
        console.log("🔥 GENERATED PASSWORD:", rawPassword);

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
            schoolCode,
            name: toTitleCase(name),
            id: id?.toUpperCase() || "",
            class: studentClass.toUpperCase(),
            section: section ? section.toUpperCase() : "A",
            gender,
            rollNo,
            house,
            bloodGroup,
            DOB: dobDate,
            admissionDate: admissionDate ? new Date(admissionDate) : new Date(),
            fatherName: toTitleCase(fatherName),
            motherName: toTitleCase(motherName),
            initialClass: initialClass ? initialClass.toUpperCase() : studentClass.toUpperCase(),
            previousSchool: toTitleCase(previousSchool),
            address: toTitleCase(address),
            fees: totalFees,
            phone: phone,
            feeStatus: feeStatusArray,
            username,
            password: hashedPassword
        });

        const savedStudent = await student.save();

        // 🔥 IMPORTANT: redirect to profile page
        return res.redirect(`/student/${savedStudent._id}`);
    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});

router.get("/student/:id", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        const student = await Student.findOne({
            _id: req.params.id,
            schoolCode: schoolCode
        });

        if (!student) {
            return res.status(404).send("Student not found");
        }

        // Classes fetch kar rahe hain (agar dropdown mein dikhani ho)
        const classList = await Student.distinct("class", { schoolCode });
        const sortedClasses = classList.sort();

        res.render("Admin/studentProfile", {
            student,
            classes: sortedClasses
        });

    } catch (err) {
        console.log("Error loading student profile:", err);
        return res.status(500).render("HomePage/500");
    }
});


// Delete student route
router.post("/delete-student/:id", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        const studentId = req.params.id;
        const student = await Student.findById(studentId);

        // 🔥 CHECK: Agar student ka username 'student_demo' hai toh delete mat hone do
        if (student && student.username === "student_demo") {
            return res.send(`
                <script>
                    alert('Notice: This is a default Demo Student. You cannot delete it, but you can delete any new student you create.');
                    window.history.back();
                </script>
            `);
        }

        await Student.findOneAndDelete({
            _id: studentId,
            schoolCode
        });
        res.redirect("/stud-menu");
    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});


//  EDIT POST Route (to update data)

function toTitleCase(str) {
    if (!str || typeof str !== 'string') return ""; // Agar khali hai to error na de
    return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase();
    });
}
router.post("/edit-student/:id", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        const {
            name, id, fatherName, motherName, phone, address,
            gender, dob, admissionDate, initialClass, previousSchool,
            rollNo, house, section, bloodGroup
        } = req.body;

        const updateData = {};

        if (name) updateData.name = toTitleCase(name);
        if (id) updateData.id = id.trim().toUpperCase();
        if (fatherName) updateData.fatherName = toTitleCase(fatherName);
        if (motherName) updateData.motherName = toTitleCase(motherName);
        if (phone) updateData.phone = phone;
        if (address) updateData.address = toTitleCase(address);
        if (gender) updateData.gender = gender;
        if (rollNo) updateData.rollNo = rollNo;
        if (house) updateData.house = house;
        if (section) updateData.section = section.trim().toUpperCase();
        if (bloodGroup) updateData.bloodGroup = bloodGroup;

        if (dob) updateData.DOB = new Date(dob);
        if (admissionDate) updateData.admissionDate = new Date(admissionDate);
        if (initialClass) updateData.initialClass = initialClass.toUpperCase();
        if (previousSchool) updateData.previousSchool = toTitleCase(previousSchool);
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        await Student.findOneAndUpdate(
            {
                _id: req.params.id,
                schoolCode
            },
            { $set: updateData });
        res.redirect(`/student/${req.params.id}`);
    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});

router.post("/student/upload-image/:id", adminAuth, async (req, res) => {
    try {
        const base64 = req.body.croppedImage;

        // Agar image data khali hai toh sidhe redirect karo
        if (!base64 || base64.trim() === "") {
            return res.redirect(`/student/${req.params.id}`);
        }

        // 🔒 Secure check: Kisi aur school ka admin dusre school ke student ki image na badal paye
        const student = await Student.findOne({
            _id: req.params.id,
            schoolCode: req.session.schoolCode
        });

        if (!student) {
            return res.status(404).send("Student not found or unauthorized");
        }

        // 🔥 CLOUDINARY UPLOAD (Direct base64 upload, zero local storage)
        const uploadResponse = await cloudinary.uploader.upload(base64, {
            folder: "School_Management_Profiles/Students",
            resource_type: "image"
        });

        // 🔄 Database me Cloudinary ka public url daal do
        await Student.findOneAndUpdate(
            { _id: req.params.id, schoolCode: req.session.schoolCode },
            { photo: uploadResponse.secure_url }
        );

        res.redirect(`/student/${req.params.id}`);

    } catch (err) {
        console.error("Error uploading student image to Cloudinary:", err);
        return res.status(500).render("HomePage/500");
    }
});


// Attandance for students + holidays

const Holiday = require("../../models/Holiday");
const Attendance = require("../../models/StudentAttendance");


router.get("/view-attendance-students", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        const classFilter = req.query.classFilter || "";
        const allClasses = await Student.distinct("class", { schoolCode });

        const studentQuery = classFilter
            ? { class: classFilter, schoolCode }
            : { schoolCode };
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
            schoolCode,
            date: { $gte: startOfMonth, $lte: endOfMonth }
        });
        // Show holiday reason
        const holidayReasons = {};
        allHolidays.forEach(h => {
            holidayReasons[moment.utc(h.date).date()] = h.reason;
        });

        const holidayDates = allHolidays.map(h => moment.utc(h.date).date());

        const attendanceData = await Attendance.find({
            schoolCode,
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
    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});


// saving attendance data in DB

// 👉 Submit Attendance Students (SECURE VERSION)
router.post("/submit-attendance-students", adminAuth, async (req, res) => {
    // Default value {} di hai taaki crash na ho agar empty aaye

    const schoolCode = req.session.schoolCode;
    let { attendance = {}, month, year } = req.body;

    const serverToday = moment.tz("Asia/Kolkata").startOf("day");

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
                // IST date for logic
                const checkDate = moment.tz(dateString, "YYYY-MM-DD", "Asia/Kolkata");

                // SAME calendar day ko UTC midnight me convert karo (DB ke liye)
                const dateForDb = moment.utc(checkDate.format("YYYY-MM-DD"), "YYYY-MM-DD").toDate();
                // --- STRICT CHECKS

                // CASE 1: FUTURE DATE -> Ignore
                if (checkDate.isAfter(serverToday, 'day')) {
                    continue;
                }

                // CASE 2: PAST EDIT -> Ignore (Agar pehle se marked hai)
                if (checkDate.isBefore(serverToday, 'day')) {
                    const existing = await Attendance.findOne({
                        studentId: studentId,
                        date: dateForDb,
                        schoolCode
                    });
                    if (existing) {
                        continue; // Edit allow nahi hai
                    }
                }

                // --- SAVE TO DB (Direct) ---
                await Attendance.findOneAndUpdate(
                    { studentId: studentId, date: dateForDb, schoolCode },
                    { status: status, schoolCode },
                    { upsert: true, new: true }
                );
            }
        }

        res.redirect(`/view-attendance-students?month=${month}&year=${year}`);

    } catch (err) {
        console.error("Error saving student attendance:", err);
        return res.status(500).render("HomePage/500");
    }
});

router.get("/promote-students", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        const classList = await Student.distinct("class", { schoolCode });

        res.render("Admin/promoteStudents", {
            classList,
            schoolCode
        });
    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});


router.post("/promote-students", adminAuth, async (req, res) => {
    try {
        const { fromClass, toClass } = req.body;
        const schoolCode = req.session.schoolCode;

        // 1. Demo Mode Protection (Hamesha zaroori hai)
        if (schoolCode === "DEMO248") {
            return res.send(`
                <script>
                    alert('Promotion feature is disabled in Demo Mode to keep data stable.');
                    window.history.back();
                </script>
            `);
        }

        // 2. Validation: Check karo dono class select ki hain ya nahi
        if (!fromClass || !toClass) {
            return res.send("<script>alert('Please select both Source and Target classes.'); window.history.back();</script>");
        }

        // 3. Validation: Kahin same class mein toh promote nahi kar rahe?
        if (fromClass === toClass) {
            return res.send("<script>alert('Source and Target class cannot be the same!'); window.history.back();</script>");
        }

        // 4. Main Logic: Bulk Update
        // Hum un sabhi students ko dhundenge jo 'fromClass' mein hain aur unhe 'toClass' mein set kar denge
        const result = await Student.updateMany(
            { class: fromClass, schoolCode: schoolCode },
            { $set: { class: toClass } }
        );

        // 5. Response
        if (result.modifiedCount > 0) {
            res.send(`
                <script>
                    alert('Success! ${result.modifiedCount} students promoted from ${fromClass} to ${toClass}.');
                    window.location.href = '/promote-students'; 
                </script>
            `);
        } else {
            res.send(`
                <script>
                    alert('No students found in Class ${fromClass}. No one was promoted.');
                    window.history.back();
                </script>
            `);
        }

    } catch (error) {
        console.error("Promotion Error:", error);
        return res.status(500).render("HomePage/500");
    }
});
module.exports = router;
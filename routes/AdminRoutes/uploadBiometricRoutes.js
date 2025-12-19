
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const moment = require("moment");
const xlsx = require("xlsx");

// MODELS
const Teacher = require("../../models/TeacherSchema");
const Staff = require("../../models/StaffSchema");
const TeacherAttendance = require("../../models/TeacherAttendance");
const StaffAttendance = require("../../models/StaffAttendance");
const { adminAuth } =  require("../../middlewares/auth");

// MULTER STORAGE
const upload = multer({ dest: "uploads/" });

router.post("/upload-biometric", upload.single("bioFile"),adminAuth, async (req, res) => {
    try {
        if (!req.file) return res.send("No file uploaded!");

        const filePath = req.file.path;
        const ext = path.extname(req.file.originalname).toLowerCase();
        let rows = [];


        // 1️⃣ READ FILE (CSV / EXCEL / TXT)

        if (ext === ".csv") {
            const content = fs.readFileSync(filePath, "utf8");
            rows = content
                .split("\n")
                .map(r => r.split(","))
                .filter(r => r.some(cell => cell && cell.toString().trim() !== ""));
        }
        else if (ext === ".xlsx" || ext === ".xls") {
            const workbook = xlsx.readFile(filePath);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            rows = xlsx.utils.sheet_to_json(sheet, { header: 1 })
                .filter(r => r.some(cell => cell && cell.toString().trim() !== ""));
        }
        else if (ext === ".txt") {
            const content = fs.readFileSync(filePath, "utf8");
            rows = content
                .split("\n")
                .map(r => r.trim().split(/\s+/))
                .filter(r => r.some(cell => cell && cell.toString().trim() !== ""));
        }
        else {
            return res.send("Unsupported file format!");
        }

        // 2️⃣ CREATE ATTENDANCE MAP

        const attendanceMap = {};

        rows.forEach((r) => {
            if (!r[0] || !r[1] || !r[2]) return;

            const empId = String(r[0]).trim();
            const rawDate = r[1];
            const rawTime = r[2];

            let formattedDate;

            // ----- DATE PARSE -----
            if (typeof rawDate === "number") {
                formattedDate = moment("1899-12-30").add(rawDate, "days").format("YYYY-MM-DD");
            } else {
                const m = moment(rawDate.toString().trim(),
                    ["YYYY-MM-DD", "DD-MM-YYYY", "MM/DD/YYYY", "DD/MM/YYYY"],
                    true
                );
                if (!m.isValid()) return;
                formattedDate = m.format("YYYY-MM-DD");
            }

            // ----- TIME PARSE -----
            let formattedTime;

            if (typeof rawTime === "number") {
                formattedTime = moment("00:00", "HH:mm")
                    .add(rawTime * 24, "hours")
                    .format("HH:mm");
            } else {
                const t = moment(rawTime.toString().trim(),
                    ["HH:mm", "HH:mm:ss", "hh:mm A"],
                    true
                );
                if (!t.isValid()) return;
                formattedTime = t.format("HH:mm");
            }

            if (!attendanceMap[empId]) attendanceMap[empId] = {};
            if (!attendanceMap[empId][formattedDate]) attendanceMap[empId][formattedDate] = [];

            attendanceMap[empId][formattedDate].push(formattedTime);
        });

        // 3️⃣ FIND WHICH ONE DATE WAS UPLOADED FROM FILE
        const allDates = new Set();

        Object.values(attendanceMap).forEach(emp => {
            Object.keys(emp).forEach(date => allDates.add(date));
        });

        if (allDates.size === 0) throw new Error("No valid date in file.");

        const uploadedDate = [...allDates][0]; // biometric files always 1-day
        const jsDate = new Date(uploadedDate);

        const allowedTime = moment("09:10", "HH:mm");


        // 4️⃣ UPDATE TEACHER + STAFF ATTENDANCE

        const employees = [
            { model: Teacher, attendanceModel: TeacherAttendance, field: "teacherId" },
            { model: Staff, attendanceModel: StaffAttendance, field: "staffId" }
        ];

        for (let empType of employees) {
            const list = await empType.model.find();

            for (let emp of list) {
                const empId = emp.empId;

                let status = "A"; // default = Absent

                if (attendanceMap[empId] && attendanceMap[empId][uploadedDate]) {
                    const punches = attendanceMap[empId][uploadedDate];
                    const inTime = moment(punches[0], "HH:mm");

                    if (inTime.isAfter(allowedTime)) status = "L";
                    else status = "P";
                }

                await empType.attendanceModel.findOneAndUpdate(
                    { [empType.field]: emp._id, date: jsDate },
                    { status, source: "biometric" },
                    { upsert: true }
                );
            }
        }

        const origin = req.body.origin;
        const redirectURL = origin === "staff"
            ? "/view-attendance-staffs"
            : "/view-attendance-teachers";

        fs.unlink(filePath, () => { });

        return res.send(`
            <script>
                alert("Biometric Attendance Uploaded Successfully!");
                window.location.href = "${redirectURL}";
            </script>
        `);

    } catch (err) {
        console.error("Biometric error:", err);
        return res.send(`
            <script>
                alert("Error processing biometric file!");
                window.location.href = "/view-attendance-teachers";
            </script>
        `);
    }
});

module.exports = router;

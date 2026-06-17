
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
const { adminAuth } = require("../../middlewares/auth");

// MULTER STORAGE
const upload = multer({ dest: "uploads/" });

// ═══════════════════════════════════════════════════════════════
//  SAMPLE DOWNLOAD — Biometric format guide
// ═══════════════════════════════════════════════════════════════
router.get("/download-biometric-sample", adminAuth, (req, res) => {
    try {
        const today = moment().format("DD-MM-YYYY");

        // Column headers
        const headers = ["Employee ID", "Date (DD-MM-YYYY)", "Time (HH:MM)"];

        // Info/guide row
        const infoRow = [
            "REQUIRED: Your EmpID from system",
            "REQUIRED: e.g. " + today,
            "REQUIRED: e.g. 09:05"
        ];

        // Sample data rows
        const sampleRows = [
            ["EMP001", today, "08:55"],
            ["EMP002", today, "09:08"],
            ["EMP003", today, "09:22"],
            ["EMP004", today, "08:45"],
            ["STF001", today, "08:55"],
            ["STF002", today, "09:08"],
            ["STF003", today, "09:22"],
            ["STF004", today, "08:45"],
        ];

        const wb = xlsx.utils.book_new();
        const wsData = [headers, infoRow, ...sampleRows];
        const ws = xlsx.utils.aoa_to_sheet(wsData);

        // Column widths
        ws["!cols"] = [{ wch: 32 }, { wch: 22 }, { wch: 18 }];

        xlsx.utils.book_append_sheet(wb, ws, "Biometric Sample");
        const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

        res.setHeader("Content-Disposition", "attachment; filename=biometric_sample.xlsx");
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        return res.send(buf);
    } catch (err) {
        console.error("Biometric sample error:", err);
        return res.status(500).send("Could not generate sample file.");
    }
});

// ═══════════════════════════════════════════════════════════════
//  UPLOAD — Biometric file (returns JSON for AJAX)
// ═══════════════════════════════════════════════════════════════
router.post("/upload-biometric", upload.single("bioFile"), adminAuth, async (req, res) => {
    const schoolCode = req.session.schoolCode;
    const filePath = req.file?.path;

    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded. Please select a file." });
        }

        const ext = path.extname(req.file.originalname).toLowerCase();
        let rows = [];

        // ── READ FILE (CSV / EXCEL / TXT) ──
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
                .map(r => r.trim().split(/[\s,\t]+/))
                .filter(r => r.some(cell => cell && cell.toString().trim() !== ""));
        }
        else {
            if (filePath) fs.unlink(filePath, () => { });
            return res.status(400).json({
                success: false,
                message: "Unsupported file format. Please upload .xlsx, .xls, .csv, or .txt file."
            });
        }

        if (rows.length === 0) {
            if (filePath) fs.unlink(filePath, () => { });
            return res.status(400).json({ success: false, message: "File is empty. No data found to process." });
        }

        // ── SKIP HEADER / GUIDE ROWS ──
        // Skip row if column 0 looks like a header or guide text
        const skipPhrases = ["employee id", "emp id", "empid", "required:", "employee", "emp_id", "date", "name"];
        rows = rows.filter(r => {
            const first = String(r[0] || "").trim().toLowerCase();
            return !skipPhrases.some(p => first.startsWith(p));
        });

        if (rows.length === 0) {
            if (filePath) fs.unlink(filePath, () => { });
            return res.status(400).json({ success: false, message: "No valid data rows found after skipping header." });
        }

        // ── BUILD ATTENDANCE MAP ──
        const attendanceMap = {};
        let parseErrors = 0;

        rows.forEach((r) => {
            if (!r[0] || !r[1] || !r[2]) { parseErrors++; return; }

            const empId = String(r[0]).trim().toUpperCase();
            const rawDate = r[1];
            const rawTime = r[2];

            let formattedDate;

            // Date parse
            if (typeof rawDate === "number") {
                formattedDate = moment("1899-12-30").add(rawDate, "days").format("YYYY-MM-DD");
            } else {
                const m = moment(rawDate.toString().trim(),
                    ["YYYY-MM-DD", "DD-MM-YYYY", "MM/DD/YYYY", "DD/MM/YYYY", "D/M/YYYY", "D-M-YYYY"],
                    true
                );
                if (!m.isValid()) { parseErrors++; return; }
                formattedDate = m.format("YYYY-MM-DD");
            }

            // Time parse
            let formattedTime;
            if (typeof rawTime === "number") {
                formattedTime = moment("00:00", "HH:mm")
                    .add(rawTime * 24, "hours")
                    .format("HH:mm");
            } else {
                const t = moment(rawTime.toString().trim(),
                    ["HH:mm", "HH:mm:ss", "hh:mm A", "H:mm"],
                    true
                );
                if (!t.isValid()) { parseErrors++; return; }
                formattedTime = t.format("HH:mm");
            }

            if (!attendanceMap[empId]) attendanceMap[empId] = {};
            if (!attendanceMap[empId][formattedDate]) attendanceMap[empId][formattedDate] = [];
            attendanceMap[empId][formattedDate].push(formattedTime);
        });

        // ── FIND DATES IN FILE ──
        const allDates = new Set();
        Object.values(attendanceMap).forEach(emp => {
            Object.keys(emp).forEach(date => allDates.add(date));
        });

        if (allDates.size === 0) {
            if (filePath) fs.unlink(filePath, () => { });
            return res.status(400).json({
                success: false,
                message: "No valid date/time data found. Please check the file format matches the sample template."
            });
        }

        const uploadedDate = [...allDates][0]; // biometric files are always 1-day
        const jsDate = new Date(uploadedDate);
        const allowedTime = moment("09:10", "HH:mm");
        const displayDate = moment(uploadedDate).format("DD MMM YYYY");

        // ── UPDATE TEACHER + STAFF ATTENDANCE ──
        const employees = [
            { model: Teacher, attendanceModel: TeacherAttendance, field: "teacherId" },
            { model: Staff, attendanceModel: StaffAttendance, field: "staffId" }
        ];

        let totalProcessed = 0;
        let presentCount = 0;
        let absentCount = 0;
        let lateCount = 0;

        for (let empType of employees) {
            const list = await empType.model.find({ schoolCode });

            for (let emp of list) {
                const empId = emp.empId?.toUpperCase();
                let status = "A"; // default = Absent

                if (attendanceMap[empId] && attendanceMap[empId][uploadedDate]) {
                    const punches = attendanceMap[empId][uploadedDate];
                    const inTime = moment(punches[0], "HH:mm");

                    if (inTime.isAfter(allowedTime)) {
                        status = "L";
                        lateCount++;
                    } else {
                        status = "P";
                        presentCount++;
                    }
                } else {
                    absentCount++;
                }

                await empType.attendanceModel.findOneAndUpdate(
                    { [empType.field]: emp._id, date: jsDate, schoolCode },
                    { status, source: "biometric", schoolCode },
                    { upsert: true }
                );
                totalProcessed++;
            }
        }

        if (filePath) fs.unlink(filePath, () => { });

        const origin = req.body.origin;
        const redirectUrl = origin === "staff" ? "/view-attendance-staffs" : "/view-attendance-teachers";

        return res.json({
            success: true,
            message: `Attendance uploaded successfully for ${displayDate}`,
            date: displayDate,
            totalProcessed,
            presentCount,
            lateCount,
            absentCount,
            parseErrors,
            redirectUrl
        });

    } catch (err) {
        if (filePath) fs.unlink(filePath, () => { });
        console.error("Biometric error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while processing file: " + err.message
        });
    }
});

module.exports = router;

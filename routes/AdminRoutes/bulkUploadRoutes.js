const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const xlsx = require("xlsx");
const bcrypt = require("bcrypt");

// MODELS
const Student = require("../../models/StudentSchema");
const Teacher = require("../../models/TeacherSchema");
const Staff = require("../../models/StaffSchema");
const { adminAuth } = require("../../middlewares/auth");

// MULTER - temp storage
const upload = multer({ dest: "uploads/bulk_temp/" });

// ─────────────────────────────────────────────────────
// HELPER: Title Case
// ─────────────────────────────────────────────────────
function toTitleCase(str) {
    if (!str || typeof str !== "string") return "";
    return str.replace(/\w\S*/g, (txt) =>
        txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
    );
}

// ─────────────────────────────────────────────────────
// HELPER: Read Excel / CSV file and return array of objects
// ─────────────────────────────────────────────────────
function parseFile(filePath, originalName) {
    const ext = path.extname(originalName).toLowerCase();
    if (ext === ".xlsx" || ext === ".xls" || ext === ".csv") {
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        return xlsx.utils.sheet_to_json(sheet, { defval: "" });
    }
    return null;
}

// ─────────────────────────────────────────────────────
// HELPER: Parse date safely from Excel serial or string
// ─────────────────────────────────────────────────────
function parseDate(val) {
    if (!val) return null;
    // Excel serial number
    if (typeof val === "number") {
        const date = xlsx.SSF.parse_date_code(val);
        if (date) {
            // Date.UTC se banao taaki timezone shift na ho
            return new Date(Date.UTC(date.y, date.m - 1, date.d));
        }
    }
    const strVal = String(val).trim();

    // Month name abbreviation map
    const monthNames = {
        jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
        jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
        january: "01", february: "02", march: "03", april: "04",
        june: "06", july: "07", august: "08", september: "09",
        october: "10", november: "11", december: "12"
    };

    // Helper to resolve month text to 2-digit number
    function resolveMonth(m) {
        const asNum = parseInt(m);
        if (!isNaN(asNum)) return String(asNum).padStart(2, "0");
        return monthNames[m.toLowerCase()] || null;
    }

    // Helper to expand 2-digit year → 4-digit
    function expandYear(yy) {
        const n = parseInt(yy);
        return n <= 30 ? 2000 + n : 1900 + n;
    }

    // Numeric patterns: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, YYYY/MM/DD
    const numericPatterns = [
        // YYYY-MM-DD  or  YYYY/MM/DD
        { regex: /^(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})$/, fn: (m) => `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}` },
        // DD-MM-YYYY  or  DD/MM/YYYY
        { regex: /^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{4})$/, fn: (m) => `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}` },
    ];
    for (const p of numericPatterns) {
        const match = strVal.match(p.regex);
        if (match) {
            const iso = p.fn(match);
            const d = new Date(iso);
            if (!isNaN(d)) return d;
        }
    }

    // Month-name patterns (separator can be space, dash, or slash)
    const sep = "[\\s\\-\\/]";
    const monthNamePatterns = [
        // DD-Mon-YYYY  e.g. 23-Jun-2026  or  23 June 2026
        { regex: new RegExp(`^(\\d{1,2})${sep}([A-Za-z]+)${sep}(\\d{4})$`), fn: (m) => { const mo = resolveMonth(m[2]); return mo ? `${m[3]}-${mo}-${m[1].padStart(2,"0")}` : null; } },
        // DD-Mon-YY  e.g. 18-Apr-18  (2-digit year — Excel default export)
        { regex: new RegExp(`^(\\d{1,2})${sep}([A-Za-z]+)${sep}(\\d{2})$`), fn: (m) => { const mo = resolveMonth(m[2]); return mo ? `${expandYear(m[3])}-${mo}-${m[1].padStart(2,"0")}` : null; } },
        // Mon-DD-YYYY  e.g. Jun-23-2026
        { regex: new RegExp(`^([A-Za-z]+)${sep}(\\d{1,2})${sep}(\\d{4})$`), fn: (m) => { const mo = resolveMonth(m[1]); return mo ? `${m[3]}-${mo}-${m[2].padStart(2,"0")}` : null; } },
        // Mon-DD-YY  e.g. Jun-23-26
        { regex: new RegExp(`^([A-Za-z]+)${sep}(\\d{1,2})${sep}(\\d{2})$`), fn: (m) => { const mo = resolveMonth(m[1]); return mo ? `${expandYear(m[3])}-${mo}-${m[2].padStart(2,"0")}` : null; } },
        // YYYY-Mon-DD  e.g. 2026-Jun-23
        { regex: new RegExp(`^(\\d{4})${sep}([A-Za-z]+)${sep}(\\d{1,2})$`), fn: (m) => { const mo = resolveMonth(m[2]); return mo ? `${m[1]}-${mo}-${m[3].padStart(2,"0")}` : null; } },
    ];
    for (const p of monthNamePatterns) {
        const match = strVal.match(p.regex);
        if (match) {
            const iso = p.fn(match);
            if (iso) {
                const d = new Date(iso);
                if (!isNaN(d)) return d;
            }
        }
    }

    // Fallback: let JS parse it (handles many natural language dates)
    const d = new Date(strVal);
    return isNaN(d) ? null : d;
}

// ─────────────────────────────────────────────────────
// HELPER: Normalize gender value to match schema enum
// ─────────────────────────────────────────────────────
function normalizeGender(val) {
    if (!val) return undefined;  // undefined = Mongoose skips enum validation
    const v = val.toString().trim().toLowerCase();
    if (v === "male" || v === "m" || v === "boy" || v === "gent") return "Male";
    if (v === "female" || v === "f" || v === "girl" || v === "lady") return "Female";
    if (v === "other" || v === "o") return "Other";
    return undefined; // unrecognized → skip (won't cause enum error)
}

function getVal(row, ...keys) {
    for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && row[k] !== "") {
            return row[k].toString().trim();
        }
    }
    return "";
}

// ─────────────────────────────────────────────────────
// HELPER: Parse phone number — handles scientific notation, country code
// ─────────────────────────────────────────────────────
function parsePhone(val) {
    if (!val) return null;
    // If it's a number (e.g., from xlsx), convert to integer first to avoid float/scientific issues
    const asFloat = parseFloat(val);
    if (!isNaN(asFloat) && isFinite(asFloat)) {
        const fullStr = Math.round(asFloat).toString().replace(/\D/g, "");
        // Extract last 10 digits (handles +91 country code prefix)
        if (fullStr.length >= 10) return parseInt(fullStr.slice(-10));
        return parseInt(fullStr) || null;
    }
    // Handle string like "9876543210" or "+919876543210"
    const stripped = val.replace(/\D/g, "");
    if (stripped.length >= 10) return parseInt(stripped.slice(-10));
    return null;
}


// ═══════════════════════════════════════════════════════════════
//  1.  SAMPLE TEMPLATE DOWNLOAD
// ═══════════════════════════════════════════════════════════════

router.get("/download-sample/:type", adminAuth, (req, res) => {
    const { type } = req.params;

    let headers = [];
    let sampleRows = [];
    let infoRow = {};   // 2nd row explaining what each column means
    let filename = "";

    if (type === "student") {
        filename = "student_upload_sample.xlsx";
        headers = [
            // ── Required ──────────────────
            "studentName",    // Student full name
            "admissionNo",    // Admission number / Student ID
            "class",          // Class (e.g. 10, 9, 8)
            "DOB",            // Date of birth YYYY-MM-DD
            // ── Academics ─────────────────
            "section",        // Section (A, B, C)
            "rollNo",         // Roll number
            "admissionDate",  // Admission date YYYY-MM-DD
            // ── Personal ──────────────────
            "gender",         // male / female / other
            "bloodGroup",     // A+, B+, O+, AB+, A-, B-, O-, AB-
            "house",          // House name (Red, Blue, Green, Yellow)
            "phone",          // Parent/Guardian phone number
            "address",        // Full home address
            // ── Fees ──────────────────────
            "fees",           // Annual academic fees (number only)
            // ── Parent Info ───────────────
            "fatherName",
            "fatherOccupation",
            "motherName",
            "motherOccupation",
            // ── Guardian Info ─────────────
            "guardianName",
            "guardianRelation",
            "guardianPhone",
            "guardianAddress",
            // ── Category & Religion ────────
            "category",       // General/OBC/SC/ST/EWS
            "religion",       // Hindu/Muslim/Christian/Sikh/Other
            "caste",
            "nationality",
            "motherTongue",
            // ── Previous School ───────────
            "initialClass",
            "previousSchool",
            // ── Govt IDs ──────────────────
            "aadharNo",
            "samagraId",
            // ── Vehicle / Transport ───────
            "isVehicleAssigned",
            "vehicleNo",
            "driverName",
            "driverPhone",
            "routeDetails",
            "vehicleFees"
        ];

        // Info row (row 2 — visible guide for users)
        infoRow = {
            studentName: "REQUIRED: Full name",
            admissionNo: "REQUIRED: Admission No",
            class: "REQUIRED: e.g. 10",
            DOB: "REQUIRED: YYYY-MM-DD",
            section: "e.g. A",
            rollNo: "e.g. 1",
            admissionDate: "YYYY-MM-DD",
            gender: "male/female/other",
            bloodGroup: "A+/B+/O+/AB+",
            house: "Red/Blue/Green/Yellow",
            phone: "10-digit number",
            address: "Full address",
            fees: "Annual fees (number)",
            fatherName: "Father full name",
            fatherOccupation: "e.g. Business",
            motherName: "Mother full name",
            motherOccupation: "e.g. Homemaker",
            guardianName: "Guardian name (if diff from parents)",
            guardianRelation: "e.g. Uncle/Grandfather",
            guardianPhone: "Guardian phone",
            guardianAddress: "Guardian address (if different)",
            category: "General/OBC/SC/ST/EWS",
            religion: "Hindu/Muslim/Christian/Sikh/Other",
            caste: "Caste (optional)",
            nationality: "Default: Indian",
            motherTongue: "e.g. Hindi",
            initialClass: "initial class",
            previousSchool: "Previous school name",
            aadharNo: "12-digit Aadhar (optional)",
            samagraId: "Samagra ID (optional)",
            isVehicleAssigned: "yes or no",
            vehicleNo: "e.g. MP04AB1234",
            driverName: "Driver full name",
            driverPhone: "Driver phone",
            routeDetails: "e.g. Route A - Kolar",
            vehicleFees: "Annual vehicle fees (number)"
        };

        sampleRows = [
            infoRow,
            {
                studentName: "Aarav Sharma",
                admissionNo: "ADM001",
                class: "10",
                DOB: "2010-05-15",
                section: "A",
                rollNo: "1",
                admissionDate: "2024-04-01",
                gender: "male",
                bloodGroup: "B+",
                house: "Red",
                phone: "9876543210",
                address: "123 Main St, Bhopal",
                fees: "12000",
                fatherName: "Ramesh Sharma",
                fatherOccupation: "Business",
                motherName: "Sunita Sharma",
                motherOccupation: "Homemaker",
                guardianName: "",
                guardianRelation: "",
                guardianPhone: "",
                guardianAddress: "",
                category: "General",
                religion: "Hindu",
                caste: "Sharma",
                nationality: "Indian",
                motherTongue: "Hindi",
                initialClass: "8",
                previousSchool: "ABC School",
                aadharNo: "123456789012",
                samagraId: "SM12345",
                isVehicleAssigned: "yes",
                vehicleNo: "MP04AB1234",
                driverName: "Ramesh Driver",
                driverPhone: "9988776655",
                routeDetails: "Route A - Kolar Road",
                vehicleFees: "6000"
            },
            {
                studentName: "Priya Gupta",
                admissionNo: "ADM002",
                class: "9",
                DOB: "2011-08-22",
                section: "B",
                rollNo: "2",
                admissionDate: "2024-04-01",
                gender: "female",
                bloodGroup: "A+",
                house: "Blue",
                phone: "9876543211",
                address: "456 Park Road, Indore",
                fees: "10000",
                fatherName: "Suresh Gupta",
                fatherOccupation: "Teacher",
                motherName: "Meena Gupta",
                motherOccupation: "Nurse",
                initialClass: "7",
                previousSchool: "",
                guardianName: "",
                guardianRelation: "",
                guardianPhone: "",
                guardianAddress: "",
                category: "OBC",
                religion: "Hindu",
                caste: "",
                nationality: "Indian",
                motherTongue: "Hindi",
                aadharNo: "",
                samagraId: "",
                isVehicleAssigned: "no",
                vehicleNo: "",
                driverName: "",
                driverPhone: "",
                routeDetails: "",
                vehicleFees: "0"
            }
        ];

    } else if (type === "teacher") {
        filename = "teacher_upload_sample.xlsx";
        headers = [
            // ── Required ──────────────────
            "name",           // Teacher full name
            "empId",          // Employee ID
            "phone",          // REQUIRED for username generation
            // ── Teaching Info ─────────────
            "subject",        // Subject(s) taught
            "class",          // Classes taught (comma-separated, e.g. 9,10,11)
            // ── Class Teacher Role ────────
            "classTeacher",   // yes / no  — Is this teacher a class teacher?
            "assignedClass",  // If classTeacher=yes, which class (e.g. 10A)
            // ── Personal ──────────────────
            "dob",            // Date of birth YYYY-MM-DD
            "gender",         // male / female / other
            "bloodGroup",     // A+, B+, O+, AB+
            "address",        // Full address
            // ── Employment ────────────────
            "salary",         // Monthly salary (number)
            "joiningDate",    // Joining date YYYY-MM-DD
            "education",      // Highest qualification
            "experience"      // Years of experience
        ];

        infoRow = {
            name: "REQUIRED: Full name",
            empId: "REQUIRED: Employee ID",
            phone: "REQUIRED: 10-digit number",
            subject: "e.g. Mathematics",
            class: "e.g. 9,10 (comma-separated)",
            classTeacher: "yes or no",
            assignedClass: "e.g. 10A (if classTeacher=yes)",
            dob: "YYYY-MM-DD",
            gender: "male/female/other",
            bloodGroup: "A+/B+/O+/AB+",
            address: "Full address",
            salary: "Monthly salary (number)",
            joiningDate: "YYYY-MM-DD",
            education: "e.g. M.Sc Mathematics",
            experience: "e.g. 5 years"
        };

        sampleRows = [
            infoRow,
            {
                name: "Anjali Verma",
                empId: "EMP001",
                phone: "9988776655",
                subject: "Mathematics",
                class: "10,11",
                classTeacher: "yes",
                assignedClass: "10A",
                dob: "1990-03-12",
                gender: "female",
                bloodGroup: "O+",
                address: "12 Civil Lines, Bhopal",
                salary: "25000",
                joiningDate: "2020-06-01",
                education: "M.Sc Mathematics",
                experience: "5 years"
            },
            {
                name: "Raj Kumar",
                empId: "EMP002",
                phone: "9988776644",
                subject: "Science",
                class: "9,10",
                classTeacher: "no",
                assignedClass: "",
                dob: "1985-11-08",
                gender: "male",
                bloodGroup: "A+",
                address: "34 MG Road, Indore",
                salary: "22000",
                joiningDate: "2018-07-15",
                education: "M.Sc Physics",
                experience: "8 years"
            },
            {
                name: "Neha Singh",
                empId: "EMP003",
                phone: "9977554433",
                subject: "English, Hindi",
                class: "6,7,8",
                classTeacher: "yes",
                assignedClass: "8B",
                dob: "1992-07-25",
                gender: "female",
                bloodGroup: "B+",
                address: "56 Shivaji Nagar, Bhopal",
                salary: "20000",
                joiningDate: "2022-04-01",
                education: "M.A. English",
                experience: "3 years"
            }
        ];

    } else if (type === "staff") {
        filename = "staff_upload_sample.xlsx";
        headers = [
            // ── Required ──────────────────
            "name",           // Staff full name
            "empId",          // Employee ID
            // ── Category ──────────────────
            "category",       // Accountant/Receptionist/Driver/Cleaner/Watchman/Peon/Other
            // ── Employment ────────────────
            "salary",         // Monthly salary (number)
            "joiningDate",    // Joining date YYYY-MM-DD
            "experience",     // Years of experience
            "education",      // Highest qualification
            // ── Contact ───────────────────
            "phone",          // Phone number
            "address",        // Full address
            // ── Personal ──────────────────
            "dob",            // Date of birth YYYY-MM-DD
            "gender",         // male / female / other
            // ── Driver Specific ───────────
            "vehicleType",    // e.g. School Bus, Van, Auto (Driver only)
            "vehicleNo",      // Vehicle registration number (Driver only)
            "route"           // Route details (Driver only)
        ];

        infoRow = {
            name: "REQUIRED: Full name",
            empId: "REQUIRED: Employee ID",
            category: "Accountant/Receptionist/Driver/Cleaner/Watchman/Peon/Other",
            salary: "Monthly salary (number)",
            joiningDate: "YYYY-MM-DD",
            experience: "e.g. 3 years",
            education: "e.g. B.Com",
            phone: "10-digit number",
            address: "Full address",
            dob: "YYYY-MM-DD",
            gender: "male/female/other",
            vehicleType: "Only if Driver — e.g. School Bus",
            vehicleNo: "Only if Driver — e.g. MP04GH5678",
            route: "Only if Driver — e.g. Route A - Kolar"
        };

        sampleRows = [
            infoRow,
            {
                name: "Mohan Lal",
                empId: "STF001",
                category: "Accountant",
                salary: "15000",
                joiningDate: "2021-04-01",
                experience: "3 years",
                education: "B.Com",
                phone: "9977665544",
                address: "78 New Market, Bhopal",
                dob: "1988-06-20",
                gender: "male",
                vehicleType: "", vehicleNo: "", route: ""
            },
            {
                name: "Ramu Driver",
                empId: "STF002",
                category: "Driver",
                salary: "12000",
                joiningDate: "2019-07-10",
                experience: "7 years",
                education: "10th Pass",
                phone: "9977665500",
                address: "12 Transport Nagar, Bhopal",
                dob: "1985-03-10",
                gender: "male",
                vehicleType: "School Bus",
                vehicleNo: "MP04GH5678",
                route: "Route B - Arera Colony"
            },
            {
                name: "Sita Bai",
                empId: "STF003",
                category: "Peon",
                salary: "8000",
                joiningDate: "2023-01-15",
                experience: "2 years",
                education: "8th Pass",
                phone: "9977665533",
                address: "90 Gandhi Nagar, Indore",
                dob: "1992-01-15",
                gender: "female",
                vehicleType: "", vehicleNo: "", route: ""
            },
            {
                name: "Priya Receptionist",
                empId: "STF004",
                category: "Receptionist",
                salary: "11000",
                joiningDate: "2022-06-01",
                experience: "4 years",
                education: "B.A.",
                phone: "9966554433",
                address: "45 Lalghati, Bhopal",
                dob: "1995-09-18",
                gender: "female",
                vehicleType: "", vehicleNo: "", route: ""
            }
        ];

    } else {
        return res.status(400).send("Invalid type");
    }

    const ws = xlsx.utils.json_to_sheet(sampleRows, { header: headers });
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
});


// ═══════════════════════════════════════════════════════════════
//  2.  BULK UPLOAD — STUDENTS  (returns JSON for AJAX)
// ═══════════════════════════════════════════════════════════════

router.post("/bulk-upload-students", adminAuth, upload.single("excelFile"), async (req, res) => {
    const schoolCode = req.session.schoolCode;
    const filePath = req.file?.path;

    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded." });
        }

        const rows = parseFile(filePath, req.file.originalname);
        if (!rows) {
            if (filePath) fs.unlink(filePath, () => { });
            return res.status(400).json({ success: false, message: "Only .xlsx, .xls or .csv files are allowed." });
        }

        if (rows.length === 0) {
            if (filePath) fs.unlink(filePath, () => { });
            return res.status(400).json({ success: false, message: "The uploaded file is empty. Please add student data and try again." });
        }

        let created = 0;
        let skipped = 0;
        const skippedList = []; // {name, id, reason}

        for (const row of rows) {
            const name = getVal(row, "studentName", "Student Name", "student name", "name", "Name", "StudentName");
            const id = getVal(row, "admissionNo", "AdmissionNo", "Admission No", "admission no", "admNo", "id", "Id", "ID", "SR No.", "SR No", "sr no", "SrNo", "srNo", "SR_No", "AdmNo").toUpperCase();
            const studentClass = getVal(row, "class", "Class", "CLASS", "currentClass", "Current Class").toUpperCase();
            const dobRaw = getVal(row, "DOB", "dob", "Dob", "Date of Birth", "date of birth", "DateOfBirth", "dateofbirth");

            // Skip the info/guide row (row 2 in template)
            if (name && name.toLowerCase().startsWith("required:")) continue;
            if (id && id.toLowerCase().startsWith("required:")) continue;

            if (!name || !id || !studentClass || !dobRaw) {
                skipped++;
                skippedList.push({
                    name: name || "(no name)",
                    id: id || "(no id)",
                    reason: "Missing required field: " + [
                        !name ? "Name" : null,
                        !id ? "Admission No" : null,
                        !studentClass ? "Class" : null,
                        !dobRaw ? "DOB" : null
                    ].filter(Boolean).join(", ")
                });
                continue;
            }

            const dobDate = parseDate(dobRaw);
            if (!dobDate) {
                skipped++;
                skippedList.push({ name, id, reason: `Invalid DOB format: "${dobRaw}" (use YYYY-MM-DD)` });
                continue;
            }

            const existing = await Student.findOne({ admissionNo: id, schoolCode });
            if (existing) {
                skipped++;
                skippedList.push({ name, id, reason: "Already exists in the system" });
                continue;
            }

            // Generate unique username
            let username;
            let usernameExists = true;
            while (usernameExists) {
                username = name.slice(0, 3).toLowerCase().replace(/\s/g, "") + "@" + dobDate.getDate() + Math.floor(10 + Math.random() * 90);
                const existingUser = await Student.findOne({ username, schoolCode });
                if (!existingUser) usernameExists = false;
            }

            const dobStr = dobDate.toISOString().split("T")[0].replace(/-/g, "");
            const rawPassword = `${dobStr}@${id}`;
            const hashedPassword = await bcrypt.hash(rawPassword, 10);

            const totalFees = parseInt(getVal(row, "fees", "Fees") || 0) || 0;
            const installmentAmount = Math.round(totalFees / 4);
            const feeStatusArray = [
                { feeType: "Admission Fee", installment: "One-time", amount: 1500, status: "Pending" },
                { feeType: "April", installment: "1st", amount: installmentAmount, status: "Pending" },
                { feeType: "September", installment: "2nd", amount: installmentAmount, status: "Pending" },
                { feeType: "December", installment: "3rd", amount: installmentAmount, status: "Pending" },
                { feeType: "February", installment: "4th", amount: installmentAmount, status: "Pending" }
            ];

            // Vehicle details
            const isVehicleRaw = getVal(row, "isVehicleAssigned", "IsVehicleAssigned").toLowerCase();
            const isVehicleAssigned = (isVehicleRaw === "yes" || isVehicleRaw === "true" || isVehicleRaw === "1");
            const totalVehicleFees = parseInt(getVal(row, "vehicleFees", "VehicleFees") || 0) || 0;
            const vehicleInstallment = Math.round(totalVehicleFees / 4);
            const vehicleFeeArray = isVehicleAssigned ? [
                { installment: "1st Installment", month: "April", amount: vehicleInstallment, status: "Pending" },
                { installment: "2nd Installment", month: "September", amount: vehicleInstallment, status: "Pending" },
                { installment: "3rd Installment", month: "December", amount: vehicleInstallment, status: "Pending" },
                { installment: "4th Installment", month: "February", amount: vehicleInstallment, status: "Pending" }
            ] : [];

            const section = (getVal(row, "section", "Section") || "A").toUpperCase();
            const admissionDate = parseDate(getVal(row, "admissionDate", "AdmissionDate")) || new Date();

            const student = new Student({
                schoolCode,
                studentName: toTitleCase(name),
                admissionNo: id,
                class: studentClass,
                section,
                rollNo: getVal(row, "rollNo", "RollNo"),
                gender: normalizeGender(getVal(row, "gender", "Gender")),
                DOB: dobDate,
                phone: parsePhone(getVal(row, "phone", "Phone")) || undefined,
                address: toTitleCase(getVal(row, "address", "Address")),
                fees: totalFees,
                fatherName: toTitleCase(getVal(row, "fatherName", "FatherName")),
                motherName: toTitleCase(getVal(row, "motherName", "MotherName")),
                fatherOccupation: toTitleCase(getVal(row, "fatherOccupation")),
                motherOccupation: toTitleCase(getVal(row, "motherOccupation")),
                bloodGroup: getVal(row, "bloodGroup", "BloodGroup"),
                house: getVal(row, "house", "House"),
                aadharNo: getVal(row, "aadharNo", "AadharNo"),
                samagraId: getVal(row, "samagraId", "SamagraId"),
                guardianName: toTitleCase(getVal(row, "guardianName")),
                guardianRelation: getVal(row, "guardianRelation"),
                guardianPhone: parseInt(getVal(row, "guardianPhone")) || null,
                guardianAddress: toTitleCase(getVal(row, "guardianAddress")),
                category: getVal(row, "category"),
                religion: getVal(row, "religion"),
                caste: toTitleCase(getVal(row, "caste")),
                nationality: getVal(row, "nationality") || "Indian",
                motherTongue: toTitleCase(getVal(row, "motherTongue")),
                previousSchool: toTitleCase(getVal(row, "previousSchool")),
                admissionDate,
                initialClass: getVal(row, "initialClass", "InitialClass") || "",
                feeStatus: feeStatusArray,
                isVehicleAssigned,
                vehicleDetails: {
                    vehicleNo: getVal(row, "vehicleNo", "VehicleNo"),
                    driverName: toTitleCase(getVal(row, "driverName", "DriverName")),
                    driverPhone: parseInt(getVal(row, "driverPhone", "DriverPhone")) || null,
                    routeDetails: getVal(row, "routeDetails", "RouteDetails"),
                    vehicleFees: totalVehicleFees
                },
                vehicleFeeStatus: vehicleFeeArray,
                username,
                password: hashedPassword
            });

            await student.save();
            created++;
        }

        if (filePath) fs.unlink(filePath, () => { });

        return res.json({
            success: true,
            created,
            skipped,
            total: rows.length,
            skippedList: skippedList.slice(0, 20), // send max 20 for display
            hasMoreSkipped: skippedList.length > 20,
            redirectUrl: "/stud-menu"
        });

    } catch (err) {
        if (filePath) fs.unlink(filePath, () => { });
        console.error("Bulk student upload error:", err);
        return res.status(500).json({ success: false, message: "Server error: " + err.message });
    }
});


// ═══════════════════════════════════════════════════════════════
//  3.  BULK UPLOAD — TEACHERS  (returns JSON for AJAX)
// ═══════════════════════════════════════════════════════════════

router.post("/bulk-upload-teachers", adminAuth, upload.single("excelFile"), async (req, res) => {
    const schoolCode = req.session.schoolCode;
    const filePath = req.file?.path;

    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded." });
        }

        const rows = parseFile(filePath, req.file.originalname);
        if (!rows) {
            if (filePath) fs.unlink(filePath, () => { });
            return res.status(400).json({ success: false, message: "Only .xlsx, .xls or .csv files are allowed." });
        }

        if (rows.length === 0) {
            if (filePath) fs.unlink(filePath, () => { });
            return res.status(400).json({ success: false, message: "The uploaded file is empty. Please add teacher data and try again." });
        }

        let created = 0;
        let skipped = 0;
        const skippedList = [];

        for (const row of rows) {
            const name = getVal(row, "name", "Name");
            const empId = getVal(row, "empId", "EmpId", "empid", "EMP_ID").toUpperCase();
            const phone = getVal(row, "phone", "Phone");

            // Skip the info/guide row
            if (name && name.toLowerCase().startsWith("required:")) continue;
            if (empId && empId.toLowerCase().startsWith("required:")) continue;

            if (!name || !empId || !phone) {
                skipped++;
                skippedList.push({
                    name: name || "(no name)",
                    id: empId || "(no empId)",
                    reason: "Missing required field: " + [
                        !name ? "Name" : null,
                        !empId ? "Employee ID" : null,
                        !phone ? "Phone" : null
                    ].filter(Boolean).join(", ")
                });
                continue;
            }

            const existing = await Teacher.findOne({ empId, schoolCode });
            if (existing) {
                skipped++;
                skippedList.push({ name, id: empId, reason: "Employee ID already exists in the system" });
                continue;
            }

            const cleanName = name.toLowerCase().replace(/\s+/g, "");
            const phoneStr = phone.toString();
            const baseUsername = `${cleanName.slice(0, 3)}@${phoneStr.slice(-4)}`;
            const usernameExists = await Teacher.findOne({ username: baseUsername, schoolCode });
            const finalUsername = usernameExists
                ? `${cleanName.slice(0, 3)}@${phoneStr.slice(-4)}${Math.floor(10 + Math.random() * 90)}`
                : baseUsername;

            const dobRaw = getVal(row, "dob", "DOB", "Dob");
            const dobDate = parseDate(dobRaw);
            let dobPart = "0000";
            if (dobDate) {
                const dd = String(dobDate.getDate()).padStart(2, "0");
                const mm = String(dobDate.getMonth() + 1).padStart(2, "0");
                dobPart = dd + mm;
            }
            const rawPassword = `${cleanName.slice(0, 2)}@${dobPart}${phoneStr.slice(-2)}`;
            const hashedPassword = await bcrypt.hash(rawPassword, 10);

            const teacher = new Teacher({
                schoolCode,
                name: toTitleCase(name),
                empId,
                subject: toTitleCase(getVal(row, "subject", "Subject")),
                class: getVal(row, "class", "Class").toUpperCase(),
                classTeacher: getVal(row, "classTeacher", "ClassTeacher").toLowerCase() === "yes" ? "yes" : "no",
                assignedClass: getVal(row, "assignedClass", "AssignedClass").toUpperCase() || undefined,
                salary: parseInt(getVal(row, "salary", "Salary")) || undefined,
                phone: parseInt(phone) || undefined,
                dob: dobDate || undefined,
                joiningDate: parseDate(getVal(row, "joiningDate", "JoiningDate")) || undefined,
                gender: normalizeGender(getVal(row, "gender", "Gender")),
                address: toTitleCase(getVal(row, "address", "Address")),
                bloodGroup: getVal(row, "bloodGroup", "BloodGroup"),
                education: getVal(row, "education", "Education"),
                experience: getVal(row, "experience", "Experience"),
                username: finalUsername,
                password: hashedPassword
            });

            await teacher.save();
            created++;
        }

        if (filePath) fs.unlink(filePath, () => { });

        return res.json({
            success: true,
            created,
            skipped,
            total: rows.length,
            skippedList: skippedList.slice(0, 20),
            hasMoreSkipped: skippedList.length > 20,
            redirectUrl: "/teach-menu"
        });

    } catch (err) {
        if (filePath) fs.unlink(filePath, () => { });
        console.error("Bulk teacher upload error:", err);
        return res.status(500).json({ success: false, message: "Server error: " + err.message });
    }
});


// ═══════════════════════════════════════════════════════════════
//  4.  BULK UPLOAD — STAFF  (returns JSON for AJAX)
// ═══════════════════════════════════════════════════════════════

router.post("/bulk-upload-staff", adminAuth, upload.single("excelFile"), async (req, res) => {
    const schoolCode = req.session.schoolCode;
    const filePath = req.file?.path;

    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded." });
        }

        const rows = parseFile(filePath, req.file.originalname);
        if (!rows) {
            if (filePath) fs.unlink(filePath, () => { });
            return res.status(400).json({ success: false, message: "Only .xlsx, .xls or .csv files are allowed." });
        }

        if (rows.length === 0) {
            if (filePath) fs.unlink(filePath, () => { });
            return res.status(400).json({ success: false, message: "The uploaded file is empty. Please add staff data and try again." });
        }

        let created = 0;
        let skipped = 0;
        const skippedList = [];

        for (const row of rows) {
            const name = getVal(row, "name", "Name");
            const empId = getVal(row, "empId", "EmpId", "empid", "EMP_ID").toUpperCase();
            const category = getVal(row, "category", "Category") || "Other";

            // Skip the info/guide row (row 2 in template)
            if (name && name.toLowerCase().startsWith("required:")) continue;
            if (empId && empId.toLowerCase().startsWith("required:")) continue;

            if (!name || !empId) {
                skipped++;
                skippedList.push({
                    name: name || "(no name)",
                    id: empId || "(no empId)",
                    reason: "Missing required field: " + [
                        !name ? "Name" : null,
                        !empId ? "Employee ID" : null
                    ].filter(Boolean).join(", ")
                });
                continue;
            }

            const existing = await Staff.findOne({ empId, schoolCode });
            if (existing) {
                skipped++;
                skippedList.push({ name, id: empId, reason: "Employee ID already exists in the system" });
                continue;
            }

            const dobRaw = getVal(row, "dob", "DOB", "Dob");
            const dobDate = parseDate(dobRaw);

            const cat = category.trim();
            const catTitled = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
            const isDriver = catTitled.toLowerCase() === "driver";

            const staff = new Staff({
                schoolCode,
                name: toTitleCase(name),
                empId,
                category: catTitled,
                salary: parseInt(getVal(row, "salary", "Salary")) || undefined,
                phone: parseInt(getVal(row, "phone", "Phone")) || undefined,
                address: toTitleCase(getVal(row, "address", "Address")),
                dob: dobDate || undefined,
                joiningDate: parseDate(getVal(row, "joiningDate", "JoiningDate")) || undefined,
                gender: normalizeGender(getVal(row, "gender", "Gender")),
                education: getVal(row, "education", "Education"),
                experience: getVal(row, "experience", "Experience"),
                // Driver-specific fields
                vehicle: isDriver ? getVal(row, "vehicleType", "VehicleType") : undefined,
                vehicleNo: isDriver ? getVal(row, "vehicleNo", "VehicleNo") : undefined,
            });

            // Store route in vehicleNo field as "vehicleNo | route" if route given
            if (isDriver) {
                const route = getVal(row, "route", "Route", "routeDetails");
                if (route) {
                    staff.vehicleNo = [getVal(row, "vehicleNo", "VehicleNo"), route].filter(Boolean).join(" | Route: ");
                }
            }

            await staff.save();
            created++;
        }

        if (filePath) fs.unlink(filePath, () => { });

        return res.json({
            success: true,
            created,
            skipped,
            total: rows.length,
            skippedList: skippedList.slice(0, 20),
            hasMoreSkipped: skippedList.length > 20,
            redirectUrl: "/staff-menu"
        });

    } catch (err) {
        if (filePath) fs.unlink(filePath, () => { });
        console.error("Bulk staff upload error:", err);
        return res.status(500).json({ success: false, message: "Server error: " + err.message });
    }
});

module.exports = router;

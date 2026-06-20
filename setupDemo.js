// Database m demo credentials save kiye is file k through

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const School = require("./models/AllSchools");
const Profile = require("./models/AdminProfileSchema");
const Teacher = require("./models/TeacherSchema");
const Student = require("./models/StudentSchema");

// Database Connection (Apni Mongo URL yahan dalo)
const MONGO_URI = "mongodb://harshitagarg2295_db_user:harshita1234@ac-dkehfvo-shard-00-00.8vzc6u5.mongodb.net:27017,ac-dkehfvo-shard-00-01.8vzc6u5.mongodb.net:27017,ac-dkehfvo-shard-00-02.8vzc6u5.mongodb.net:27017/schoolDB?ssl=true&replicaSet=atlas-f5u3z6-shard-0&authSource=admin&appName=Cluster0"

async function setup() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to DB...");

        const schoolCode = "DEMO248";
        const plainPassword = "demo123";
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        // 1. Create Demo School
        await School.findOneAndUpdate(
            { code: schoolCode },
            {
                name: "VidhyaLitee Demo School",
                code: schoolCode,
                status: 'Active',
                subscriptionEnd: new Date("2030-12-31")
            },
            { upsert: true }
        );

        // 2. Create Admin
        await Profile.findOneAndUpdate(
            { username: "admin_demo", schoolCode: schoolCode },
            { name: "Demo Admin", username: "admin_demo", password: hashedPassword, schoolCode: schoolCode },
            { upsert: true }
        );

        // 3. Create Teacher
        await Teacher.findOneAndUpdate(
            { username: "teacher_demo", schoolCode: schoolCode },
            { name: "Demo Teacher", username: "teacher_demo", password: hashedPassword, schoolCode: schoolCode, phone: "9999999999" },
            { upsert: true }
        );

        // 4. Create Student

        const totalFees = 40000;
        const installmentAmount = Math.round(totalFees / 4);

        const demoFeeStatus = [
            {
                feeType: "Admission Fee",
                installment: "One-time",
                amount: 1500,
                status: "Paid",
                mode: "Online",
                paymentDate: new Date("2026-05-15") // Sahi Date Format
            },
            {
                feeType: "April",
                installment: "1st",
                amount: installmentAmount,
                status: "Paid",
                mode: "Online",
                paymentDate: new Date("2026-05-15")
            },
            {
                feeType: "September",
                installment: "2nd",
                amount: installmentAmount,
                status: "Pending",
                mode: "",
                paymentDate: null 
            },
            {
                feeType: "December",
                installment: "3rd",
                amount: installmentAmount,
                status: "Pending",
                mode: "",
                paymentDate: null
            },
            {
                feeType: "February",
                installment: "4th",
                amount: installmentAmount,
                status: "Pending",
                mode: "",
                paymentDate: null
            }
        ];
        await Student.findOneAndUpdate(
            { username: "student_demo", schoolCode: schoolCode },
            {
                studentName: "Demo Student",
                admissionNo:"ST101",
                username: "student_demo",
                password: hashedPassword,
                schoolCode: schoolCode,
                phone: "8888888888",
                class: "10",
                section: "A",
                DOB: new Date("2010-01-01"),
                fees: totalFees,
                feeStatus: demoFeeStatus 
            },
            { upsert: true } // isse bar bar duplicate ni banega isi me update hoga chahe kitni b bar chalao
        );
        console.log("🔥🔥 Demo School & Users Created Successfully!");
        process.exit();
    } catch (err) {
        console.error(err);
    }
}

setup();
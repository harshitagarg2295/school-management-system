const mongoose = require('mongoose')

const teacherSchema = new mongoose.Schema({

    schoolCode: {
        type: String,
        required: true
    },

    // 🔹 Basic Info
    name: String,
    empId: String,
    subject: String,
    class: String,
    salary: Number,

    // 🔹 Contact
    address: String,
    phone: Number,

    // 🔹 Auth
    username: { type: String, required: true},
    password: { type: String, required: true },

    // 🔹 Role Info
    classTeacher: { type: String, enum: ["yes", "no"] },
    assignedClass: { type: String },

   
    gender: {
        type: String,
        enum: ["Male", "Female", "Other"]
    },

    dob: Date,

    bloodGroup: String,

    joiningDate: {
        type: Date,
        default: Date.now
    },

    education: String,

    experience: String,

    photo: String  

}, { timestamps: true });

teacherSchema.index({ username: 1, schoolCode: 1 }, { unique: true });

module.exports = mongoose.model('TeacherSchema', teacherSchema);
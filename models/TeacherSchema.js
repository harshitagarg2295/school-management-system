
const mongoose = require('mongoose')

// Creating Schema for Teachers list

const teacherSchema = new mongoose.Schema({
    name: String,
    empId: String,
    subject: String,
    class: String,
    salary: Number,
    address: String,
    phone: Number,
    username: { type: String, required: true, unique: true }, // username फ़ील्ड जोड़ा
    password: { type: String, required: true },
    classTeacher: { type: String, enum: ["yes", "no"]},
    assignedClass: { type: String }, // ye wo class store karegi jo select ki

});
module.exports = mongoose.model('TeacherSchema', teacherSchema);

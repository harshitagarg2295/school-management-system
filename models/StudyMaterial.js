const mongoose = require("mongoose");

const StudyMaterialSchema = new mongoose.Schema({
    schoolCode: {
        type: String,
        required: true
    },
    class: String,
    title: String,
    description: String,
    fileUrl: String,     // e.g., "/uploads/chapter1.pdf" or Cloudinary URL
    uploadedBy: String,  // Teacher ID/Name
    uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("StudyMaterial", StudyMaterialSchema)
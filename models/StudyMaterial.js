const mongoose = require("mongoose");

const StudyMaterialSchema = new mongoose.Schema({
    schoolCode: {
        type: String,
        required: true
    },
    class: String,
    title: String,
    description: String,
    fileUrl: String,     
    publicId: String,    // Cloudinary se file delete karne ke liye zaroori hai
    uploadedBy: String,  // Teacher ID/Name
    uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("StudyMaterial", StudyMaterialSchema)
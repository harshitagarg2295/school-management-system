const express = require('express');
const router = express.Router();
const profile = require("../../models/AdminProfileSchema");
const { adminAuth } = require("../../middlewares/auth");

const path = require("path");
const fs = require("fs");

// --- GET PROFILE VIEW ---
router.get("/profile-menu", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        const admin = await profile.findOne({ schoolCode });
        res.render("Admin/profile", { admin });
    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).send("Internal Server Error");
    }
});


// --- IMAGE UPLOAD FOLDER CONFIG ---
const uploadPath = path.join(__dirname, "../../uploads/admin");
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}


// --- FIXED MASTER POST ROUTE (Handles Details + Image Crop together) ---
router.post("/edit-details", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        const { name, email, mobile, address, bio, croppedImage } = req.body;

        // Update object setup
        let updateData = { name, email, mobile, address, bio, schoolCode };

        // Check if a new cropped image exists
        if (croppedImage && croppedImage.trim() !== "") {
            
            // Clean base64 string metadata
            const base64Image = croppedImage.replace(/^data:image\/\w+;base64,/, "");
            
            // Convert to buffer
            const buffer = Buffer.from(base64Image, "base64");

            // Generate unique filename
            const fileName = "profile-" + Date.now() + ".jpg";
            const filePath = path.join(uploadPath, fileName);

            // Write file to folder
            fs.writeFileSync(filePath, buffer);

            // Attach filename to database data
            updateData.image = fileName;
        }

        // Upsert standard dataset inside single MongoDB call
        await profile.findOneAndUpdate(
            { schoolCode },                     
            updateData,                         
            { new: true, upsert: true }         
        );

        res.redirect("/profile-menu");

    } catch (error) {
        console.error("Error saving profile details or image:", error);
        res.status(500).send("Error updating profile");
    }
});

module.exports = router;
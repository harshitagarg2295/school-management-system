const express = require('express');
const router = express.Router();
const profile = require("../../models/AdminProfileSchema");
const { adminAuth } = require("../../middlewares/auth");
const { cloudinary } = require("../../config/cloudinaryConfig");

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

// --- FIXED MASTER POST ROUTE (Handles Details + Image Crop together) ---
router.post("/edit-details", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        const { name, email, mobile, address, bio, croppedImage } = req.body;

        // Update object setup
        let updateData = { name, email, mobile, address, bio, schoolCode };

        // Check if a new cropped image exists
        if (croppedImage && croppedImage.trim() !== "") {

            // 🔥 CLOUDINARY UPLOAD (No fs, no path, no buffer!)
            const uploadResponse = await cloudinary.uploader.upload(croppedImage, {
                folder: "School_Management_Profiles/Admin",
                resource_type: "image"
            });

            // Database data me direct online URL lagao
            updateData.image = uploadResponse.secure_url;
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
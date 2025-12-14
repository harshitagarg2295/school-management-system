const express = require('express')
const router = express.Router()
const profile = require("../../models/AdminProfileSchema");
const { adminAuth } =  require("../../middlewares/auth");

const path = require("path");
const fs = require("fs");


router.get("/profile-menu",adminAuth, async (req, res) => {

    const admin = await profile.findOne();
    res.render("Admin/profile", { admin });
})

// Post route for saving admin profile details

router.post("/edit-details", async (req, res) => {

    const { name, email, mobile, address, bio } = req.body;

    await profile.findOneAndUpdate(
        {},                                     // filter (single admin)
        { name, email, mobile, address, bio },  // update data
        { new: true, upsert: true }             // create if not found
    )

    res.redirect("/profile-menu")
})

// Route For upload image

// Create upload folder if not exists
const uploadPath = path.join(__dirname, "../../uploads/profile");
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}


// --- IMAGE UPLOAD ROUTE ---

router.post("/upload-profile-image", async (req, res) => {
    const base64Data = req.body.croppedImage;

    if (!base64Data || base64Data.trim() === "") {
        return res.redirect("/profile-menu");
    }

    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Image, "base64");

    const fileName = "profile-" + Date.now() + ".jpg";
    const filePath = path.join(uploadPath, fileName);

    fs.writeFileSync(filePath, buffer);

    await profile.findOneAndUpdate(
        {},
        { image: fileName },
        { upsert: true }
    );

    res.redirect("/profile-menu");
});


module.exports = router
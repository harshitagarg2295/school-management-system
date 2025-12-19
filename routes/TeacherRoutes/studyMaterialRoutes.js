
const express = require('express')
const router = express.Router()
const Student = require("../../models/StudentSchema")

const multer = require("multer"); //sabse common for handling file uploads in Express.
const fs = require('fs'); // fs module
const StudyMaterial = require("../../models/StudyMaterial");
const {teacherAuth} =  require("../../middlewares/auth");

// ... (Multer storage setup and upload middleware remains the same) ...

const storage = multer.diskStorage({
    destination: "uploads/study-material/",
    filename: (req, file, cb) => {
        const safeFilename = file.originalname.replace(/ /g, '_');
        cb(null, Date.now() + '-' + safeFilename);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 50 }
});

// ----------------------------------------
// Function to prepare class list (for both GET and POST)
// ----------------------------------------
const prepareClassList = async () => {
    const classList = await Student.distinct("class");
    const classOrder = [
        "Nursery", "LKG", "UKG",
        "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
        "11", "12"
    ];

    classList.sort((a, b) => {
        const idxA = classOrder.indexOf(a);
        const idxB = classOrder.indexOf(b);
        return (idxA === -1 ? Infinity : idxA) - (idxB === -1 ? Infinity : idxB);
    });
    return classList;
};


// ----------------------------------------
// GET Route: Renders the form
// ----------------------------------------
router.get("/teachers/upload-material",teacherAuth, async (req, res) => {
    // ✅ classList is fetched and passed correctly here
    const classList = await prepareClassList();
    res.render("Teachers/uploadStudyMaterial", {
        classList,
        selectedClass: req.query.class || "",
        // Query parameter se status/error message uthana
        status: req.query.status,
        errorMessage: req.query.error ? "Please select Class, Title, Description, and at least one File." : null
    });
});


// ----------------------------------------
// POST Route: Handles upload and DB save
// ----------------------------------------
router.post("/teachers/upload-material", upload.array("material", 10),teacherAuth, async (req, res) => {
    const { title, description, className } = req.body;
    const uploadedFiles = req.files;

    // Validation
    if (!className || !title || !description || !uploadedFiles || uploadedFiles.length === 0) {

        if (uploadedFiles) {
            for (const file of uploadedFiles) {
                try {
                    // Cleanup successful uploads from local disk
                    fs.unlinkSync(file.path);
                } catch (e) {
                    console.error("Failed to delete file:", e.message);
                }
            }
        }
        // Redirect to GET route with error flag
        return res.redirect("/teachers/upload-material?error=missing_fields&class=" + className);
    }

    try {
        // Save to DB
        for (const file of uploadedFiles) {
            await StudyMaterial.create({
                class: className,
                title: title,
                description: description,
                fileUrl: `/uploads/study-material/${file.filename}`,
                uploadedBy: req.session.teacherName,
                uploadedAt: new Date()
            });
        }

        // Success Redirect
        res.redirect("/teachers/upload-material?status=success");

    } catch (error) {
        console.error("Error during material upload or DB save:", error);
        res.redirect("/teachers/upload-material?status=fail");
    }
});


router.get("/teachers/view-material",teacherAuth, async (req, res) => {
    const teacherName = req.session.teacherName

    if (!teacherName) {
        return res.redirect("/teacher.html")
    }
    const selectedClass = req.query.class;

    let query = { uploadedBy: teacherName };

    if (selectedClass && selectedClass !== "") {
        query.class = selectedClass;
    }
    const materials = await StudyMaterial.find(query)
        .sort({ uploadedAt: -1 });


    const classList = await prepareClassList();


    res.render("Teachers/viewStudyMaterial", {
        materials: materials,
        currentTeacherName: teacherName,
        classList: classList,
        selectedClass: selectedClass
    });

})
module.exports = router;

const express = require('express')
const router = express.Router()
const Student = require("../../models/StudentSchema")

const multer = require("multer"); //sabse common for handling file uploads in Express.
const fs = require('fs'); // fs module
const StudyMaterial = require("../../models/StudyMaterial");
const { teacherAuth } = require("../../middlewares/auth");

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
const prepareClassList = async (schoolCode) => {
    const classList = await Student.distinct("class", { schoolCode });
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
router.get("/teachers/upload-material", teacherAuth, async (req, res) => {
    // ✅ classList is fetched and passed correctly here

    const schoolCode = req.session.schoolCode;
    const classList = await prepareClassList(schoolCode);
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
router.post("/teachers/upload-material", upload.array("material", 10), teacherAuth, async (req, res) => {
    const schoolCode = req.session.schoolCode;
    const { title, description, className } = req.body;
    const uploadedFiles = req.files;


    // 🔥 1. DEMO SIZE CHECK
    if (schoolCode === "DEMO248" && uploadedFiles) {
        const demoSizeLimit = 2 * 1024 * 1024; // 2MB Limit
        for (const file of uploadedFiles) {
            if (file.size > demoSizeLimit) {
                // Pehle file delete karo jo multer ne save kar di hai
                for (const f of uploadedFiles) {
                    if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
                }
                return res.send(`
                    <script>
                        alert('Demo Mode Limit: You cannot upload files larger than 2MB. This is to save server space during your trial.');
                        window.history.back();
                    </script>
                `);
            }
        }
    }

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
                uploadedAt: new Date(),
                schoolCode
            });
        }

        // Success Redirect
        res.redirect("/teachers/upload-material?status=success");

    } catch (error) {
        console.error("Error during material upload or DB save:", error);
        res.redirect("/teachers/upload-material?status=fail");
    }
});


router.get("/teachers/view-material", teacherAuth, async (req, res) => {
    const schoolCode = req.session.schoolCode;
    const teacherName = req.session.teacherName

    if (!teacherName) {
        return res.redirect("/login")
    }
    const selectedClass = req.query.class;

    let query = { uploadedBy: teacherName, schoolCode };

    if (selectedClass && selectedClass !== "") {
        query.class = selectedClass;
    }
    const materials = await StudyMaterial.find(query)
        .sort({ uploadedAt: -1 });


    const classList = await prepareClassList(schoolCode);


    res.render("Teachers/viewStudyMaterial", {
        materials: materials,
        currentTeacherName: teacherName,
        classList: classList,
        selectedClass: selectedClass
    });

})

// Study Material Delete Route
const path = require('path'); // Isse path handle karna aasan hoga

router.get("/teachers/delete-material/:id", teacherAuth, async (req, res) => {
    try {
        const materialId = req.params.id;
        const schoolCode = req.session.schoolCode;

        const material = await StudyMaterial.findById(materialId);
        if (!material) return res.redirect("/teachers/view-material");


        // 1. File Delete Logic
        // Aapka fileUrl hai: /uploads/study-material/filename.pdf
        // Humne '.' isliye lagaya taaki ye root directory se start kare
        const filePath = path.join(__dirname, '../../', material.fileUrl); 
        // Note: '../../' isliye kyunki aapka route file shayad routes/teachers/ folder mein hai.
        // Agar file seedha routes folder mein hai toh '../' use karein.

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log("File deleted from server:", filePath);
        } else {
            console.log("File not found on server, just deleting from DB");
        }

        // 2. DB Delete Logic
        await StudyMaterial.findByIdAndDelete(materialId);

        res.redirect("/teachers/view-material?status=deleted");
    } catch (error) {
        console.error("Delete Error:", error);
        res.redirect("/teachers/view-material?status=error");
    }
});

module.exports = router;
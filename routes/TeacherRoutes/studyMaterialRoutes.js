const express = require('express');
const router = express.Router();
const Student = require("../../models/StudentSchema");
const StudyMaterial = require("../../models/StudyMaterial");
const { teacherAuth } = require("../../middlewares/auth");

const { cloudinary, uploadMaterial } = require("../../config/CloudinaryConfig"); 

// ----------------------------------------
// Function to prepare class list
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

// GET Route: Renders the form
router.get("/teachers/upload-material", teacherAuth, async (req, res) => {
    const schoolCode = req.session.schoolCode;
    const classList = await prepareClassList(schoolCode);
    res.render("Teachers/uploadStudyMaterial", {
        classList,
        selectedClass: req.query.class || "",
        status: req.query.status,
        errorMessage: req.query.error ? "Please select Class, Title, Description, and at least one File." : null
    });
});

// POST Route: Handles upload and DB save (Cloudinary version)
router.post("/teachers/upload-material", uploadMaterial.array("material", 10), teacherAuth, async (req, res) => {
    const schoolCode = req.session.schoolCode;
    const { title, description, className } = req.body;
    const uploadedFiles = req.files; // Ab isme Cloudinary ke links aayenge

    // 🔥 1. DEMO SIZE CHECK (Cloudinary upload ke baad check ho rha h)
    if (schoolCode === "DEMO248" && uploadedFiles) {
        const demoSizeLimit = 2 * 1024 * 1024; // 2MB Limit
        for (const file of uploadedFiles) {
            if (file.size > demoSizeLimit) {
                // Cloudinary se upload hui saari files delete karo
                for (const f of uploadedFiles) {
                    await cloudinary.uploader.destroy(f.filename, { resource_type: 'raw' });
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

    // Validation Check
    if (!className || !title || !description || !uploadedFiles || uploadedFiles.length === 0) {
        if (uploadedFiles) {
            // Agar fields missing hain toh uploaded files Cloudinary se hatao
            for (const file of uploadedFiles) {
                await cloudinary.uploader.destroy(file.filename, { resource_type: 'raw' });
            }
        }
        return res.redirect("/teachers/upload-material?error=missing_fields&class=" + className);
    }

    try {
        // Save to DB
        for (const file of uploadedFiles) {
            await StudyMaterial.create({
                class: className,
                title: title,
                description: description,
                fileUrl: file.path,        // Cloudinary Secure URL (https://...)
                publicId: file.filename,   // 🔥 Cloudinary public_id for deletion
                uploadedBy: req.session.teacherName,
                uploadedAt: new Date(),
                schoolCode
            });
        }

        res.redirect("/teachers/upload-material?status=success");

    } catch (error) {
        console.error("Error during material upload or DB save:", error);
        // Error aane par uploaded files clean karo
        if (uploadedFiles) {
            for (const file of uploadedFiles) {
                await cloudinary.uploader.destroy(file.filename, { resource_type: 'raw' });
            }
        }
        res.redirect("/teachers/upload-material?status=fail");
    }
});

// VIEW ROUTE
router.get("/teachers/view-material", teacherAuth, async (req, res) => {
    const schoolCode = req.session.schoolCode;
    const teacherName = req.session.teacherName;

    if (!teacherName) return res.redirect("/login");
    
    const selectedClass = req.query.class;
    let query = { uploadedBy: teacherName, schoolCode };

    if (selectedClass && selectedClass !== "") {
        query.class = selectedClass;
    }
    const materials = await StudyMaterial.find(query).sort({ uploadedAt: -1 });
    const classList = await prepareClassList(schoolCode);

    res.render("Teachers/viewStudyMaterial", {
        materials: materials,
        currentTeacherName: teacherName,
        classList: classList,
        selectedClass: selectedClass
    });
});

// 🔥 🔥 DELETE ROUTE (Cloudinary Destroy + DB Delete)
router.get("/teachers/delete-material/:id", teacherAuth, async (req, res) => {
    try {
        const materialId = req.params.id;
        const material = await StudyMaterial.findById(materialId);
        
        if (!material) return res.redirect("/teachers/view-material");

        // 1. Cloudinary se file delete karo
        if (material.publicId) {
            // Note: raw files (PDFs/Docs) ke liye resource_type batana padta hai
            await cloudinary.uploader.destroy(material.publicId, { resource_type: 'raw' });
        }

        // 2. DB se entry delete karo
        await StudyMaterial.findByIdAndDelete(materialId);

        res.redirect("/teachers/view-material?status=deleted");
    } catch (error) {
        console.error("Delete Error:", error);
        res.redirect("/teachers/view-material?status=error");
    }
});

module.exports = router;
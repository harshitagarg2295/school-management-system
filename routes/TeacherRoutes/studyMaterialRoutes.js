const express = require('express');
const router = express.Router();
const https = require('https');
const Student = require("../../models/StudentSchema");
const StudyMaterial = require("../../models/StudyMaterial");
const { teacherAuth } = require("../../middlewares/auth");

const { cloudinary, uploadMaterial } = require("../../config/cloudinaryConfig");
const { redirectDownload, redirectPreview } = require("../../utils/streamHelper");

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
    try {
        const schoolCode = req.session.schoolCode;
        const classList = await prepareClassList(schoolCode);
        res.render("Teachers/uploadStudyMaterial", {
            classList,
            selectedClass: req.query.class || "",
            status: req.query.status,
            errorMessage: req.query.error ? "Please select Class, Title, Description, and at least one File." : null
        });
    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});

// POST Route: Handles upload and DB save (Cloudinary version)
router.post("/teachers/upload-material", uploadMaterial.array("material", 10), teacherAuth, async (req, res) => {

    let uploadedFiles = [];

    try {
        const schoolCode = req.session.schoolCode;
        const { title, description, className } = req.body;
        uploadedFiles = req.files || []; // Ab isme Cloudinary ke links aayenge

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
        // Save to DB
        for (const file of uploadedFiles) {
            await StudyMaterial.create({
                class: className,
                title: title,
                description: description,
                fileUrl: file.path,        // Cloudinary Secure URL (https://...)
                publicId: file.filename,   // Cloudinary public_id for deletion
                fileType: file.mimetype,   // MIME type — for reliable detection
                uploadedBy: req.session.teacherName,
                uploadedAt: new Date(),
                schoolCode
            });
        }

        res.redirect("/teachers/upload-material?status=success");

    } catch (error) {
        console.error("Error during material upload or DB save:", error);
        // Error aane par uploaded files clean karo
        if (uploadedFiles.length > 0) {
            for (const file of uploadedFiles) {
                await cloudinary.uploader.destroy(file.filename, { resource_type: 'raw' });
            }
        }
        return res.redirect("/teachers/upload-material?status=fail");
    }
});

// VIEW ROUTE
router.get("/teachers/view-material", teacherAuth, async (req, res) => {
    try {
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
    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});

// 🔥 🔥 DELETE ROUTE (Cloudinary Destroy + DB Delete)
router.get("/teachers/delete-material/:id", teacherAuth, async (req, res) => {
    try {
        const materialId = req.params.id;
        const material = await StudyMaterial.findById(materialId);

        if (!material) return res.redirect("/teachers/view-material");

        // 1. Cloudinary se file delete karo
        if (material.publicId) {
            // Image ya raw dono possible hain — try both
            const isImage = material.fileUrl && (
                material.fileUrl.includes('/image/upload/') ||
                /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(material.fileUrl)
            );
            try {
                await cloudinary.uploader.destroy(material.publicId, {
                    resource_type: isImage ? 'image' : 'raw'
                });
            } catch (e) {
                // If first attempt fails, try the other type silently
                try {
                    await cloudinary.uploader.destroy(material.publicId, {
                        resource_type: isImage ? 'raw' : 'image'
                    });
                } catch (e2) { /* ignore */ }
            }
        }

        // 2. DB se entry delete karo
        await StudyMaterial.findByIdAndDelete(materialId);

        res.redirect("/teachers/view-material?status=deleted");
    } catch (error) {
        console.error("Delete Error:", error);
        res.redirect("/teachers/view-material?status=error");
    }
});

// ─── Helper: detect MIME from fileType (DB) > URL > publicId ─────────────────
function detectMime(fileUrl, publicId, fileType) {
    const mimeMap = {
        "application/pdf": { ext: ".pdf", ct: "application/pdf" },
        "image/jpeg": { ext: ".jpg", ct: "image/jpeg" },
        "image/png": { ext: ".png", ct: "image/png" },
        "image/gif": { ext: ".gif", ct: "image/gif" },
        "image/webp": { ext: ".webp", ct: "image/webp" },
        "image/svg+xml": { ext: ".svg", ct: "image/svg+xml" },
        "application/msword": { ext: ".doc", ct: "application/msword" },
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { ext: ".docx", ct: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
        "application/vnd.ms-excel": { ext: ".xls", ct: "application/vnd.ms-excel" },
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { ext: ".xlsx", ct: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
        "application/vnd.ms-powerpoint": { ext: ".ppt", ct: "application/vnd.ms-powerpoint" },
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": { ext: ".pptx", ct: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
        "text/plain": { ext: ".txt", ct: "text/plain" },
        "application/zip": { ext: ".zip", ct: "application/zip" }
    };
    const extCtMap = {
        ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
        ".svg": "image/svg+xml", ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls": "application/vnd.ms-excel",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".ppt": "application/vnd.ms-powerpoint",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".txt": "text/plain", ".zip": "application/zip"
    };

    // 1. DB fileType (most reliable — saved at upload time)
    if (fileType && mimeMap[fileType]) {
        return { ext: mimeMap[fileType].ext, contentType: mimeMap[fileType].ct };
    }
    // 2. Detect from URL
    const urlLower = (fileUrl || "").toLowerCase();
    const pidLower = (publicId || "").toLowerCase();
    const extMatch = urlLower.match(/\.(pdf|jpg|jpeg|png|gif|webp|svg|doc|docx|xls|xlsx|ppt|pptx|txt|zip)(\?|$)/);
    const pidMatch = pidLower.match(/\.(pdf|jpg|jpeg|png|gif|webp|svg|doc|docx|xls|xlsx|ppt|pptx|txt|zip)$/);
    const rawExt = extMatch ? "." + extMatch[1] : (pidMatch ? "." + pidMatch[1] : "");
    return { ext: rawExt, contentType: extCtMap[rawExt] || "application/octet-stream" };
}

// ✅ DOWNLOAD
router.get("/teachers/download-material/:id", teacherAuth, async (req, res) => {
    try {
        const material = await StudyMaterial.findById(req.params.id);
        if (!material || !material.fileUrl) return res.redirect("/teachers/view-material");
        redirectDownload(material.fileUrl, res, "/teachers/view-material");
    } catch (err) {
        console.error("Download Error:", err);
        res.redirect("/teachers/view-material");
    }
});

// ✅ PREVIEW
router.get("/teachers/preview-material/:id", teacherAuth, async (req, res) => {
    try {
        const material = await StudyMaterial.findById(req.params.id);
        if (!material || !material.fileUrl) return res.redirect("/teachers/view-material");
        redirectPreview(material.fileUrl, res, "/teachers/view-material");
    } catch (err) {
        console.error("Preview Error:", err);
        res.redirect("/teachers/view-material");
    }
});

module.exports = router;
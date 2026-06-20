const express = require('express');
const router = express.Router();
const https = require('https');
const Student = require("../../models/StudentSchema");
const StudyMaterial = require("../../models/StudyMaterial");
const { teacherAuth } = require("../../middlewares/auth");

const { cloudinary, uploadMaterial } = require("../../config/cloudinaryConfig");

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

// ✅ DOWNLOAD ROUTE — Works for PDF, Image, DOCX, any format
router.get("/teachers/download-material/:id", teacherAuth, async (req, res) => {
    try {
        const material = await StudyMaterial.findById(req.params.id);
        if (!material || !material.fileUrl) {
            return res.redirect("/teachers/view-material");
        }

        const fileUrl = material.fileUrl;
        const publicId = material.publicId;

        // Detect if it is an image
        const isImage = fileUrl.includes('/image/upload/') ||
            /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileUrl);

        if (isImage) {
            // Image: add fl_attachment transformation so browser downloads it
            const downloadUrl = cloudinary.url(publicId, {
                resource_type: 'image',
                flags: 'attachment',
                secure: true,
                sign_url: true,
                type: 'upload'
            });
            return res.redirect(downloadUrl);
        } else {
            // PDF / DOCX / other raw files
            // IMPORTANT: publicId in DB may NOT include file extension,
            // so cloudinary.url(publicId) would generate a URL that 404s.
            // Instead, inject fl_attachment directly into the stored fileUrl
            // (Cloudinary secure_url) which always has the correct full path.
            let downloadUrl = fileUrl;
            if (fileUrl.includes('/upload/')) {
                downloadUrl = fileUrl.replace('/upload/', '/upload/fl_attachment/');
            }
            return res.redirect(downloadUrl);
        }
    } catch (err) {
        console.error("Download Error:", err);
        return res.redirect("/teachers/view-material");
    }
});

// ✅ PREVIEW ROUTE — Streams the file from Cloudinary with correct headers
// (fl_inline doesn't work for raw resources; server-side proxy is reliable)
router.get("/teachers/preview-material/:id", teacherAuth, async (req, res) => {
    try {
        const material = await StudyMaterial.findById(req.params.id);
        if (!material || !material.fileUrl) return res.redirect("/teachers/view-material");

        const fileUrl = material.fileUrl;

        // Determine content type from the URL
        const urlLower = fileUrl.toLowerCase();
        let contentType = 'application/octet-stream';
        if (/\.pdf($|\?)/i.test(urlLower))       contentType = 'application/pdf';
        else if (/\.(jpg|jpeg)($|\?)/i.test(urlLower)) contentType = 'image/jpeg';
        else if (/\.png($|\?)/i.test(urlLower))  contentType = 'image/png';
        else if (/\.gif($|\?)/i.test(urlLower))  contentType = 'image/gif';
        else if (/\.webp($|\?)/i.test(urlLower)) contentType = 'image/webp';
        else if (/\.svg($|\?)/i.test(urlLower))  contentType = 'image/svg+xml';
        // If URL has no extension, try publicId
        else if (material.publicId) {
            const pid = material.publicId.toLowerCase();
            if (pid.endsWith('.pdf'))  contentType = 'application/pdf';
            else if (/\.(jpg|jpeg)$/.test(pid)) contentType = 'image/jpeg';
            else if (pid.endsWith('.png')) contentType = 'image/png';
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');

        // Stream the file from Cloudinary to the browser
        const request = https.get(fileUrl, (stream) => {
            // If Cloudinary provides Content-Length, forward it
            if (stream.headers['content-length']) {
                res.setHeader('Content-Length', stream.headers['content-length']);
            }
            stream.pipe(res);
        });
        request.on('error', (err) => {
            console.error('Preview stream error:', err);
            res.redirect("/teachers/view-material");
        });
    } catch (err) {
        console.error('Preview Error:', err);
        res.redirect("/teachers/view-material");
    }
});

module.exports = router;
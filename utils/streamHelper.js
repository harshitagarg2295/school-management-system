/**
 * streamHelper.js — Browser Redirect Approach
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-side proxy kaam nahi karta kyunki Cloudinary Node.js server ke
 * requests pe 401 deta hai (signed URL pe bhi).
 *
 * Solution: Browser ko directly Cloudinary URL pe redirect karo.
 * - Browser ka request → Cloudinary CDN → file serve hoti hai (200 OK)
 * - Download ke liye: fl_attachment flag URL mein inject karo
 * - Preview ke liye: fl_inline flag inject karo (PDF browser mein khulega)
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * redirectDownload(fileUrl, publicId, res, fallbackRedirect)
 * Browser ko Cloudinary URL pe redirect karo for file download.
 * fl_attachment → browser download dialog dikhayega
 */
function redirectDownload(fileUrl, res, fallbackRedirect) {
    if (!fileUrl) return res.redirect(fallbackRedirect);

    let downloadUrl = fileUrl;
    // Inject fl_attachment transformation
    if (fileUrl.includes('/upload/')) {
        downloadUrl = fileUrl.replace('/upload/', '/upload/fl_attachment/');
    }
    return res.redirect(downloadUrl);
}

/**
 * redirectPreview(fileUrl, res, fallbackRedirect)
 * Browser ko Cloudinary URL pe redirect karo for inline preview.
 * fl_inline → browser PDF viewer mein khulega
 */
function redirectPreview(fileUrl, res, fallbackRedirect) {
    if (!fileUrl) return res.redirect(fallbackRedirect);

    let previewUrl = fileUrl;
    // fl_inline: Content-Disposition: inline → browser opens it
    if (fileUrl.includes('/upload/')) {
        previewUrl = fileUrl.replace('/upload/', '/upload/fl_inline/');
    }
    return res.redirect(previewUrl);
}

module.exports = { redirectDownload, redirectPreview };

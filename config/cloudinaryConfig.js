const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// profiles Images ka storage 
const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'School_Management_Profiles',
    allowed_formats: ['jpg', 'png', 'jpeg'],
    transformation: [{ width: 400, height: 400, crop: 'thumb', gravity: 'face' }]
  },
});
const uploadProfile = multer({ storage: profileStorage });

//  NAYA STORAGE STUDY MATERIAL KE LIYE (PDF, Docs, Jpg sab chalega)
const materialStorage = new CloudinaryStorage({

  cloudinary: cloudinary,
  params: async (req, file) => {
    const isImage = file.mimetype.startsWith('image/');

    // 🔥 Real file name nikalne ke liye (बिना extension ke, jaise 'chapter1')
    const originalName = file.originalname.split('.').slice(0, -1).join('.');
    // Unique rakhne ke liye thoda timestamp jod dete hain taaki same naam ki do files takrayen nahi
    const customPublicId = `${originalName}-${Date.now()}`;

    if (isImage) {
      const ext = file.mimetype.split('/')[1];

      return {
        folder: 'School_Management_Material',
        resource_type: 'image',
        format: ext,
        public_id: customPublicId // Real name set ho jayega
      };
    } else {
      const extension = file.originalname.split('.').pop().toLowerCase();

      return {
        folder: 'School_Management_Material',
        resource_type: 'raw',
        public_id: `${customPublicId}.${extension}`
      };
    }
  }
});
const uploadMaterial = multer({ storage: materialStorage });

module.exports = { cloudinary, uploadProfile, uploadMaterial };
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// 1. Cloudinary ko .env file ke credentials se connect karo
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Storage ka design aur rules set karo
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'School_Management_Profiles', // Cloudinary me is naam ka folder automatic ban jayega
    allowed_formats: ['jpg', 'png', 'jpeg'], // Sirf photo allowed hain
    transformation: [{ width: 400, height: 400, crop: 'thumb', gravity: 'face' }] // 🔥 Mast Feature: Face detect karke passport size crop kar dega automatic!
  },
});

const upload = multer({ storage: storage });

module.exports = { cloudinary, upload };
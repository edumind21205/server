const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('./cloudinary');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'edumids_uploads', // Change folder name as needed
    resource_type: 'auto', // auto-detect (image, video, pdf, etc.)
  },
});

const upload = multer({ storage: storage });

module.exports = upload;
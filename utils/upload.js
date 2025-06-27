const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("./cloudinary"); 
// Configure Cloudinary storage for uploaded files
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    console.log("[DEBUG] Uploading file:", file.originalname, "with mimetype:", file.mimetype);
    let folder = "edumids";
    let resource_type = "auto";
    if (file.mimetype.startsWith("video/")) {
      folder = "edumids/videos";
      resource_type = "video";
    } else if (file.mimetype === "application/pdf") {
      folder = "edumids/pdfs";
      resource_type = "raw"; // <-- ensure this is set for PDFs
    }
    return {
      folder,
      resource_type, // <-- this line ensures correct resource_type
      format: file.originalname.split(".").pop(),
    };
  },
});

const upload = multer({ storage });

module.exports = upload;

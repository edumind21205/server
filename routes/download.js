const express = require("express");
const path = require("path");
const fs = require("fs");
const { verifyToken } = require("../middleware/authMiddleware");
const DownloadHistory = require("../Models/downloadHistory");
const Lesson = require("../Models/lesson");
const router = express.Router();

// Download a lesson file and log the download history
router.get("/lesson/:lessonId", verifyToken, async (req, res) => {
  try {
    const lessonId = req.params.lessonId;
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });
    if (!lesson.contentType || !["video", "pdf"].includes(lesson.contentType)) {
      return res.status(400).json({ message: "This lesson type cannot be downloaded." });
    }
    if (!lesson.contentURL) {
      return res.status(404).json({ message: "No file found for this lesson." });
    }
    // Fetch course title for the lesson
    let courseTitle = "-";
    if (lesson.courseId) {
      try {
        const Course = require("../Models/course").Course;
        const course = await Course.findById(lesson.courseId);
        if (course && course.title) courseTitle = course.title;
      } catch (e) { /* ignore */ }
    }
    // Log download history
    await DownloadHistory.create({
      user: req.user ? req.user.id : null,
      fileName: lesson.title || lesson.name || lesson.contentURL,
      filePath: lesson.contentURL,
      // Save course title
      courseTitle: courseTitle,
      ip: req.ip,
      userAgent: req.headers["user-agent"] || "",
    });
    // If contentURL is a Cloudinary/external URL, respond with the URL for frontend to handle
    if (lesson.contentURL.startsWith("http")) {
      // Handle Cloudinary protected resources (PDF/Video)
      if (
        lesson.contentURL.includes("cloudinary.com") &&
        (lesson.contentType.toLowerCase() === "pdf" || lesson.contentType.toLowerCase() === "video")
      ) {
        const cloudinary = require("cloudinary").v2;
        let publicId = null;
        let resourceType = "raw";
        if (lesson.contentType.toLowerCase() === "pdf") {
          // Extract publicId WITH .pdf extension
          let matches = lesson.contentURL.match(/\/upload\/(?:v\d+\/)?(.+\.pdf)/i);
          publicId = matches && matches[1] ? matches[1] : null;
          if (!publicId) {
            return res.status(400).json({ message: "Invalid Cloudinary URL for download." });
          }
          const signedUrl = cloudinary.utils.private_download_url(
            publicId,
            "raw",
            {
              type: "authenticated",
              attachment: true,
              expires_at: Math.floor(Date.now() / 1000) + 60 * 5,
            }
          );
          return res.json({ url: signedUrl });
        } else if (lesson.contentType.toLowerCase() === "video") {
          // For videos, return the original contentURL (public streaming URL)
          return res.json({ url: lesson.contentURL });
        }
        // fallback: just return the URL
        return res.json({ url: lesson.contentURL });
      }
      // For other external URLs, just return as before
      return res.json({ url: lesson.contentURL });
    }
    // Build file path for local files
    const filePath = lesson.contentURL.startsWith("uploads/")
      ? path.join(__dirname, "..", lesson.contentURL)
      : path.join(__dirname, "..", "uploads", lesson.contentURL);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File does not exist on server." });
    }
    // If PDF, add logo to top right before sending
    if (lesson.contentType && lesson.contentType.toLowerCase() === "pdf" && filePath.endsWith('.pdf')) {
      const PDFDocument = require("pdfkit");
      const tmp = require("os").tmpdir();
      const logoPath = path.join(__dirname, '../../frontend/public/assets/logo.png');
      const outPath = path.join(tmp, `LessonWithLogo-${lesson._id}-${Date.now()}.pdf`);
      const doc = new PDFDocument({ autoFirstPage: false });
      const writeStream = fs.createWriteStream(outPath);
      doc.pipe(writeStream);
      // Read original PDF and add as background
      const hummus = require('hummus');
      try {
        const pdfReader = hummus.createReader(filePath);
        for (let i = 0; i < pdfReader.getPagesCount(); i++) {
          doc.addPage({ size: pdfReader.parsePage(i).getMediaBox() });
          // Add logo to top right
          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, doc.page.width - 120, 30, { width: 80 });
          }
        }
        doc.end();
        writeStream.on('finish', () => {
          res.download(outPath, path.basename(filePath), (err) => {
            if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
            if (err) {
              console.error("Download error:", err);
              res.status(500).json({ message: "Error downloading file." });
            }
          });
        });
      } catch (e) {
        // fallback: send original file
        res.download(filePath, path.basename(filePath));
      }
      return;
    }
    // Download file
    res.download(filePath, path.basename(filePath), (err) => {
      if (err) {
        console.error("Download error:", err);
        res.status(500).json({ message: "Error downloading file." });
      }
    });
  } catch (error) {
    console.error("Error in download-lesson:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// (Updated) Get download history for current user or all if admin
router.get("/history", verifyToken, async (req, res) => {
  try {
    let history;
    if (req.user.role === "admin") {
      history = await DownloadHistory.find()
        .populate("user", "name email")
        .sort({ downloadedAt: -1 });
    } else {
      history = await DownloadHistory.find({ user: req.user.id })
        .populate("user", "name email")
        .sort({ downloadedAt: -1 });
    }
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

module.exports = router;

const express = require("express");
const Lesson = require("../Models/lesson");
const { Course } = require("../Models/course");
const auth = require("../middleware/auth");
const { lessonValidation } = require("../validators/lessonValidator");
const { validationResult } = require("express-validator");
const upload = require("../utils/upload");
const notifyUser = require("../utils/notifyUser");
const router = express.Router();
const { verifyToken, checkRole } = require("../middleware/authMiddleware");


// ✅ Add a Lesson to a Course (Admin/Teacher)
router.post(
  "/add",
  auth,
  checkRole(["teacher"]),
  upload.single("file"),
  lessonValidation,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { courseId, title, contentType } = req.body;
      const createdBy = req.user.id;
      let contentURL = req.body.contentURL;

      // If file is uploaded, set contentURL to the file path
      if (req.file) {
        console.log(req.file);
        
        contentURL = req.file.path;
        // PDF validation: If contentType is pdf, check mimetype and extension
        if (contentType === "pdf") {
          const isPDF = req.file.mimetype === "application/pdf" && req.file.originalname.toLowerCase().endsWith(".pdf");
          if (!isPDF) {
            // Delete from Cloudinary if uploaded
            if (contentURL.startsWith("http")) {
              const cloudinary = require("../utils/cloudinary");
              // Extract public_id from URL
              const matches = contentURL.match(/\/([^\/]+)\.[a-zA-Z0-9]+$/);
              if (matches && matches[1]) {
                await cloudinary.uploader.destroy(`edumids/${matches[1]}`);
              }
            }
            return res.status(400).json({ message: "Uploaded file is not a valid PDF." });
          }
        }
        // If uploading to Cloudinary here, ensure resource_type: "raw"
        /*
        const cloudinary = require("../utils/cloudinary");
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          resource_type: "raw",
          folder: "edumids/lessons"
        });
        contentURL = uploadResult.secure_url;
        */
      }

      // Validate required fields
      if (!courseId || !title || !contentType || !contentURL || !createdBy) {
        return res.status(400).json({ message: "Course ID, title, content type, content URL, and createdBy are required" });
      }

      // Validate content type
      const validContentTypes = ["video", "pdf", "quiz", "link"];
      if (!validContentTypes.includes(contentType)) {
        return res.status(400).json({ message: "Invalid content type. Must be one of: video, pdf, quiz, link" });
      }              

      // Check if the course exists
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      // Check if the logged-in user is the course instructor (admin/teacher)
      if (course.createdBy.toString() !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Create the lesson with createdBy
      const lesson = new Lesson({ courseId, title, contentType, contentURL, createdBy });
      await lesson.save();

      // Add lesson to course
      course.lessons.push(lesson._id);
      await course.save();

      // Notify the instructor
      await notifyUser(course.createdBy, `A new lesson "${lesson.title}" has been added to your course.`);

      res.status(201).json({ message: "Lesson added successfully", lesson });
    } catch (error) {
      console.error("Error adding lesson:", error.message);
      res.status(500).json({ message: "Server Error", error: error.message });
    }
  }
);

// ✅ Upload File for Lesson Content
router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  res.status(200).json({
    message: "File uploaded successfully",
    filePath: `/uploads/${req.file.filename}`,
  });
});

// ✅ Update Lesson (Admin Only)
router.put("/update/:lessonId", auth, async (req, res) => {
  try {
    const { title, contentType, contentURL } = req.body;
    const { lessonId } = req.params;

    // Find the lesson
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    // Check if the logged-in user is the course instructor (admin)
    const course = await Course.findById(lesson.courseId);
    if (!course || (course.createdBy.toString() !== req.user.id && req.user.role !== "teacher")) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Update the lesson
    lesson.title = title || lesson.title;
    lesson.contentType = contentType || lesson.contentType;
    lesson.contentURL = contentURL || lesson.contentURL;

    await lesson.save();
    res.status(200).json({ message: "Lesson updated successfully", lesson });
  } catch (error) {
    console.error("Error updating lesson:", error.message); // Log the error message
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// ✅ Delete Lesson (Admin Only)
router.delete("/delete/:lessonId", auth, async (req, res) => {
  try {
    const { lessonId } = req.params;

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    // Check if the logged-in user is the course instructor (admin)
    const course = await Course.findById(lesson.courseId);
    if (!course || (course.createdBy.toString() !== req.user.id && req.user.role !== "admin")) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await Lesson.findByIdAndDelete(lessonId);

    // Remove lesson from the course
    course.lessons = course.lessons.filter((id) => id.toString() !== lessonId);
    await course.save();

    res.status(200).json({ message: "Lesson deleted successfully" });
  } catch (error) {
    console.error("Error deleting lesson:", error.message); // Log the error message
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Fetch All Lessons for a Course
router.get("/course/:courseId", auth, async (req, res) => {
  try {
    const { courseId } = req.params;

    // Check if the course exists
    const course = await Course.findById(courseId).populate("lessons");
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.status(200).json({ lessons: course.lessons });
  } catch (error) {
    console.error("Error fetching lessons:", error.message); // Log the error message
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Fetch a single lesson by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }
    res.status(200).json(lesson);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

module.exports = router;
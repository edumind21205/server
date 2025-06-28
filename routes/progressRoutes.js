const Progress = require("../Models/Progress");
const express = require("express");
const router = express.Router();
const { Course, CourseProgress } = require("../Models/course");
const Lesson = require("../Models/lesson");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");
const notifyUser = require("../utils/notifyUser");
const Enrollment = require("../Models/Enrollment");
const cloudinary = require("cloudinary").v2;
const Category = require("../Models/Category"); // Add this import

// Helper to fetch category details by name
async function getCategoryByName(name) {
  if (!name) return null;
  return await Category.findOne({ name });
}

// ✅ Mark a Lesson as Completed
router.post("/complete-lesson", verifyToken, checkRole(["student"]), async (req, res) => {
  const { courseId, lessonId } = req.body;

  try {
    // Find or create progress for the user and course
    let progress = await Progress.findOne({ student: req.user.id, course: courseId });

    if (!progress) {
      progress = new Progress({ student: req.user.id, course: courseId, completedLessons: [] });
    }

    // Add the lesson to completedLessons if not already completed
    if (!progress.completedLessons.map(id => String(id)).includes(String(lessonId))) {
      progress.completedLessons.push(lessonId);
    }

    // Calculate progress percentage
    const totalLessons = await Lesson.countDocuments({ courseId });
    progress.progressPercentage = (progress.completedLessons.length / totalLessons) * 100;

    await progress.save();

    // Update Enrollment progress field as well
    const enrollment = await Enrollment.findOne({ student: req.user.id, course: courseId });
    if (enrollment) {
      enrollment.progress = progress.progressPercentage;
      await enrollment.save();
    }

    // Notify the user if the course is completed
    if (progress.progressPercentage === 100) {
      const course = await Course.findById(courseId);
      await notifyUser(req.user.id, `🏁 Congratulations! You've completed the course "${course.title}".`);
    }

    res.status(200).json({ message: "Lesson marked as completed", progress });
  } catch (error) {
    console.error("Error marking lesson as completed:", error.message);
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Get all progress for a student (with course and lesson details)
router.get("/my-progress", verifyToken, checkRole(["student"]), async (req, res) => {
  try {
    const progresses = await Progress.find({ student: req.user.id })
      .populate({
        path: "course",
        populate: [
          { path: "createdBy", select: "firstName lastName" },
          { path: "category", select: "name" },
          { path: "lessons" },
        ],
      })
      .populate("completedLessons");
    return res.status(200).json(progresses);
  } catch (error) {
    console.error("Error fetching all progress:", error.message);
    return res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Get all enrolled courses with progress for a student
router.get("/my-enrolled-progress", verifyToken, checkRole(["student"]), async (req, res) => {
  try {
    // Find all enrollments for the student
    const enrollments = await Enrollment.find({ student: req.user.id }).populate({
      path: "course",
      populate: [
        { path: "createdBy", select: "name" }, // use name instead of fullname
        { path: "lessons", model: "Lesson" },
      ],
    });

    // Fetch all progress documents for the user
    const progresses = await Progress.find({ student: req.user.id });

    // Map courseId to progress for quick lookup
    const progressMap = {};
    progresses.forEach((p) => {
      progressMap[p.course.toString()] = p;
    });

    // Build result: for each enrollment, attach progress if exists
    const result = [];
    for (const enrollment of enrollments) {
      if (!enrollment.course || !enrollment.course._id) continue;
      const course = enrollment.course;

      // Get category name
      let categoryName = "-";
      if (course.category && typeof course.category === "object" && course.category.name) {
        categoryName = course.category.name;
      }

      // Get teacher name
      let teacherName = "-";
      if (course.createdBy && typeof course.createdBy === "object") {
        teacherName = course.createdBy.name || "-";
      }
      // Debug log for teacherName
      // console.log("[DEBUG] teacherName for course", course.title, ":", teacherName);

      const progress = progressMap[course._id.toString()];
      result.push({
        courseId: course,
        teacherName,
        categoryName,
        progressPercentage: progress ? progress.progressPercentage : 0,
        completedLessons: progress ? progress.completedLessons : [],
        _id: progress ? progress._id : null,
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching enrolled courses with progress:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// Place this route AFTER all other /:param routes to avoid collision
// ✅ Get Student Progress for a Course
router.get("/:courseId", verifyToken, checkRole(["student"]), async (req, res, next) => {
  const mongoose = require("mongoose");
  if (!mongoose.Types.ObjectId.isValid(req.params.courseId)) return next();
  try {
    const progress = await Progress.findOne({
      student: req.user.id,
      course: req.params.courseId,
    }).populate("completedLessons");

    if (!progress) return res.status(404).json({ message: "No progress found" });

    res.status(200).json(progress);
  } catch (error) {
    console.error("Error fetching progress:", error.message);
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Download a lesson file (student access)
router.get("/download-lesson/:lessonId", verifyToken, async (req, res) => {
  try {
    const lessonId = req.params.lessonId;
    const lesson = await require("../Models/lesson").findById(lessonId);
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });
    // Only allow download for video/pdf
    if (!lesson.contentType || !["video", "pdf"].includes(lesson.contentType.toLowerCase())) {
      return res.status(400).json({ message: "This lesson type cannot be downloaded." });
    }
    if (!lesson.contentURL) {
      return res.status(404).json({ message: "No file found for this lesson." });
    }
    // If contentURL is a Cloudinary/external URL, respond with the URL
    if (lesson.contentURL.startsWith("http")) {
      if (
        lesson.contentURL.includes("cloudinary.com") &&
        (lesson.contentType.toLowerCase() === "pdf" || lesson.contentType.toLowerCase() === "video")
      ) {
        let publicId = null;
        let resourceType = "raw";
        if (lesson.contentType.toLowerCase() === "pdf") {
          // Extract publicId WITH .pdf extension (since your Cloudinary resource has .pdf in publicId)
          // Improved regex to handle possible folder structure and versioning
          let matches = lesson.contentURL.match(/\/upload\/(?:v\d+\/)?([\w\/-]+\.pdf)/i);
          publicId = matches && matches[1] ? matches[1] : null;
          if (!publicId) {
            // Try fallback extraction (for edge cases)
            let fallback = lesson.contentURL.split("/upload/")[1];
            if (fallback && fallback.endsWith(".pdf")) publicId = fallback;
          }
          if (!publicId) {
            return res.status(400).json({ message: "Invalid Cloudinary URL for download (PDF publicId extraction failed)." });
          }
          // Always use resource_type: 'raw' for PDF
          try {
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
          } catch (err) {
            console.error("Cloudinary PDF signed URL error:", err);
            return res.status(500).json({ message: "Failed to generate signed PDF download URL.", error: err.message });
          }
        } else if (lesson.contentType.toLowerCase() === "video") {
          // For videos, return the original contentURL (public streaming URL)
          return res.json({ url: lesson.contentURL });
        }
        return res.json({ url: lesson.contentURL });
      }
      return res.json({ url: lesson.contentURL });
    }
    // Build file path for local files
    const path = require("path");
    const filePath = lesson.contentURL.startsWith("uploads/") ? path.join(__dirname, "..", lesson.contentURL) : path.join(__dirname, "..", "uploads", lesson.contentURL);
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

module.exports = router;
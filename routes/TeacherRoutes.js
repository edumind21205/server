const express = require("express");
const router = express.Router();
const { verifyToken, checkRole } = require("../middleware/authMiddleware");
const jwt = require("jsonwebtoken"); 
const Lesson = require("../Models/lesson");
const { Course } = require("../Models/course");
const User = require("../Models/user");
const Quiz = require("../Models/quiz"); 
const upload = require("../utils/upload");
const notifyUser = require("../utils/notifyUser");
const { validationResult } = require("express-validator");
const { createCourseValidation } = require("../validators/courseValidator");



// ✅ Create a Course (Teacher Only) with picture upload
router.post(
  "/create-course",
  verifyToken,
  checkRole(["teacher"]),
  upload.single("picture"),
  createCourseValidation, 
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { title, description, category, price } = req.body;
      const priceNum = Number(price);
      if (!title || !description || !category || price === undefined) {
        return res.status(400).json({ message: "Title, description, category, and price are required" });
      }
      if (isNaN(priceNum)) {
        return res.status(400).json({ message: "Price must be a number" });
      }

      let picture = "";
      if (req.file) {
        picture = req.file.path.replace(/\\/g, "/");
      }

      console.log("req.user:", req.user);
      console.log("Course data to save:", {
        title,
        description,
        category,
        price: priceNum,
        createdBy: req.user.id,
        picture,
      });

      const course = new Course({
        title,
        description,
        category,
        price: priceNum,
        createdBy: req.user.id,
        picture,
      });
      await course.save();

      const courseObj = course.toObject();
      courseObj.id = courseObj._id;

      await notifyUser(req.user.id, `✅ Course "${title}" created successfully!`);
      res.status(201).json({ message: "Course created successfully", course: courseObj });
    } catch (error) {
      console.error("Error creating course:", error, error?.stack);
      res.status(500).json({ message: "Server Error", error: error.message || error });
    }
  }
);

// ✅ Add a Lesson to a Course (Teacher Only) with file upload support
router.post(
  "/lessons",
  verifyToken,
  checkRole(["teacher"]),
  upload.single("file"), // Accept a file field named "file"
  async (req, res) => {
    try {
      const { courseId, title, contentType, contentURL, createdBy } = req.body;

      // Validate request
      if (!courseId || !title || !contentType) {
        return res.status(400).json({ message: "CourseId, title, and contentType are required" });
      }

      // Check if the course exists
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      // Check if the logged-in user is the teacher of the course
      if (course.createdBy.toString() !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      let finalContentURL = contentURL;
      // If a file is uploaded, use its path as contentURL
      if (req.file) {
        finalContentURL = req.file.path.replace(/\\/g, "/");
      }

      // Create a new lesson
      const lesson = new Lesson({ courseId, title, contentType, contentURL: finalContentURL, createdBy });
      await lesson.save();

      // Add lesson ID to the course's lessons array
      await Course.findByIdAndUpdate(courseId, { $push: { lessons: lesson._id } });

      await notifyUser(req.user.id, `✅ Lesson "${title}" added to course.`);
      res.status(201).json({ message: "Lesson added successfully", lesson });
    } catch (error) {
      res.status(500).json({ message: "Server Error", error });
    }
  }
);

// ✅ Update a Course (Teacher Only) with picture upload
router.put(
  "/courses/:id",
  verifyToken,
  checkRole(["teacher"]),
  upload.single("picture"),
  async (req, res) => {
    try {
      const course = await Course.findById(req.params.id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      // Only the teacher who created the course can update it
      if (course.createdBy.toString() !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      course.title = req.body.title || course.title;
      course.description = req.body.description || course.description;
      if (req.file) {
        course.picture = req.file.path.replace(/\\/g, "/");
      }

      await course.save();
      await notifyUser(req.user.id, `✏️ Course "${course.title}" updated successfully!`);
      res.status(200).json({ message: "Course updated successfully", course });
    } catch (error) {
      console.error("Error updating course:", error);
      res.status(500).json({ message: "Server Error", error });
    }
  }
);

// ✅ Delete a Course (Teacher Only)
router.delete("/courses/:id", verifyToken, checkRole(["teacher"]), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    // Debug: Log IDs before authorization check
    console.log("course.createdBy:", course.createdBy.toString());
    console.log("req.user.id:", req.user.id);

    // Only the teacher who created the course can delete it
    if (course.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    await Course.findByIdAndDelete(req.params.id);

    await notifyUser(req.user.id, `🗑️ Course "${course.title}" deleted successfully!`);
    res.status(200).json({ message: "Course deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Get All Users (Teacher Only)
router.get("/users", verifyToken, checkRole(["teacher"]), async (req, res) => {
  try {
    const users = await User.find().select("-password"); // Exclude passwords
    // await notifyUser(req.user.id, `👋 Welcome back to your Teacher Dashboard.`);
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Update User Role (Teacher Only)
router.put("/update-user-role/:userId", verifyToken, checkRole(["teacher"]), async (req, res) => {
  try {
    const { role } = req.body;
    const updatedUser = await User.findByIdAndUpdate(req.params.userId, { role }, { new: true });

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    await notifyUser(req.user.id, `✅ User role updated to "${role}".`);
    res.status(200).json({ message: "User role updated successfully", user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Delete a User (Teacher Only)
router.delete("/delete-user/:userId", verifyToken, checkRole(["teacher"]), async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.userId);
    await notifyUser(req.user.id, `🗑️ User deleted successfully!`);
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Get All Courses Created by the Logged-in Teacher
router.get(
  "/my-courses",
  verifyToken,
  checkRole(["teacher"]),
  async (req, res) => {
    try {
      const courses = await Course.find({ createdBy: req.user.id }).select("_id title description picture category price createdAt");
      res.status(200).json(courses);
    } catch (error) {
      res.status(500).json({ message: "Server Error", error });
    }
  }
);

// ✅ Get All Lessons for a Course (Teacher Only)
router.get(
  "/course-lessons/:courseId",
  verifyToken,
  checkRole(["teacher"]),
  async (req, res) => {
    try {
      const course = await Course.findById(req.params.courseId).populate("lessons");
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      // Only the teacher who created the course can view its lessons
      if (course.createdBy.toString() !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      // await notifyUser(req.user.id, `👋 Welcome back to your Teacher Dashboard.`);
      res.status(200).json(course.lessons);
    } catch (error) {
      res.status(500).json({ message: "Server Error", error });
    }
  }
);

// ✅ Get All Quizzes Created by the Logged-in Teacher
router.get(
  "/my-quizzes",
  verifyToken,
  checkRole(["teacher"]),
  async (req, res) => {
    try {
      // Find all courses created by this teacher
      const courses = await Course.find({ createdBy: req.user.id }).select("_id");
      const courseIds = courses.map((c) => c._id); 

      // Find all quizzes for those courses
      const quizzes = await Quiz.find({ course: { $in: courseIds } })
        .populate("course", "title")
        .sort({ createdAt: -1 });

      res.status(200).json(quizzes);
    } catch (error) {
      res.status(500).json({ message: "Server Error", error });
    }
  }
);

// Example: Get all quizzes for teacher's courses
router.get("/teacher/all-quizzes", verifyToken, checkRole(["teacher"]), async (req, res) => {
  try {
    const courses = await Course.find({ createdBy: req.user.id }).select("_id"); // <-- use _id
    const courseIds = courses.map(c => c._id); // <-- use _id for mapping
    const quizzes = await Quiz.find({ course: { $in: courseIds } }).populate("course");
    res.json(quizzes);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Add a Quiz to a Course (Teacher Only)
router.post(
  "/courses/:courseId/quizzes",
  verifyToken,
  checkRole(["teacher"]),
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const { title, questions } = req.body;

      // Validate input
      if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ message: "Title and at least one question are required." });
      }

      // Check if the course exists and belongs to the teacher
      const course = await Course.findById(courseId);
      console.log("req.user:", req.user);
      console.log("course.createdBy:", course?.createdBy?.toString());
      console.log("req.user.id:", req.user.id);
      if (!course) return res.status(404).json({ message: "Course not found." });
      if (course.createdBy.toString() !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Create the quiz
      const quiz = new Quiz({ course: courseId, title, questions });
      await quiz.save();

      await notifyUser(req.user.id, `✅ Quiz "${title}" added to course "${course.title}".`);
      res.status(201).json({ message: "Quiz created successfully", quiz });
    } catch (error) {
      res.status(500).json({ message: "Server Error", error });
    }
  }
);

// Get all quizzes for a course (Teacher Only)
router.get(
  "/quizzes/course/:courseId",
  verifyToken,
  checkRole(["teacher"]),
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const quizzes = await Quiz.find({ course: courseId }).sort({ createdAt: -1 });
      res.status(200).json(quizzes);
    } catch (error) {
      res.status(500).json({ message: "Server Error", error });
    }
  }
);

// ✅ Get All Teachers (Public)
router.get("/all", async (req, res) => {
  try {
    const teachers = await User.find({ role: "teacher" }).select("-password");
    res.status(200).json(teachers);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const { Course } = require("../Models/course");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");
const { createCourseValidation } = require("../validators/courseValidator");
const { validationResult } = require("express-validator");
const upload = require("../utils/upload");

// 🟡 Get All Courses (For Students) - PUBLIC
router.get("/", async (req, res) => {
  try {
    const courses = await Course.find().populate("createdBy", "name email");
    res.json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ message: "Error fetching courses" });
  }
});

// Middleware to verify token (applies to all routes below)
router.use(verifyToken);

// 🟢 Create a Course (Only Teachers/Admins)
router.post(
  "/create",
  upload.single("picture"),
  createCourseValidation,
  checkRole(["teacher", "admin"]),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { title, description, category, price } = req.body;
      let picture = "";
      if (req.file) {
        picture = req.file.path.replace(/\\/g, "/");
      }

      if (!title || !description || !category || price === undefined) {
        return res.status(400).json({ message: "Title, description, category, and price are required" });
      }

      const newCourse = new Course({
        title,
        description,
        category,
        price,
        createdBy: req.user.id,
        picture,
      });

      await newCourse.save();
      res.status(201).json({ message: "Course created successfully!", course: newCourse });
    } catch (error) {
      console.error("Error creating course:", error);
      res.status(500).json({ message: "Error creating course", error });
    }
  }
);

// 🔵 Get Single Course by ID
router.get("/:id", async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).populate("createdBy", "name email");
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json(course);
  } catch (error) {
    console.error("Error fetching course:", error);
    res.status(500).json({ message: "Error fetching course" });
  }
});

// 🟠 Update a Course (Only the Creator or Admin)
router.put("/:id", upload.single("picture"), checkRole(["teacher", "admin"]), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found" });

    if (course.createdBy.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to update this course" });
    }

    course.title = req.body.title || course.title;
    course.description = req.body.description || course.description;
    course.category = req.body.category || course.category;
    if (req.body.price !== undefined) {
      course.price = req.body.price;
    }
    if (req.file) {
      course.picture = req.file.path.replace(/\\/g, "/");
    }

    await course.save();
    res.json({ message: "Course updated successfully!", course });
  } catch (error) {
    console.error("Error updating course:", error);
    res.status(500).json({ message: "Error updating course" });
  }
});

// 🔴 Delete a Course (Only the Creator or Admin)
router.delete("/:id", checkRole(["teacher", "admin"]), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found" });

    if (course.createdBy.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to delete this course" });
    }

    await course.deleteOne();
    res.json({ message: "Course deleted successfully!" });
  } catch (error) {
    console.error("Error deleting course:", error);
    res.status(500).json({ message: "Error deleting course" });
  }
});

module.exports = router;


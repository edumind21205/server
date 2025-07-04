// Unified search route for courses, lessons, quizzes, assignments
const express = require("express");
const router = express.Router();
const { Course } = require("../Models/course");
const Lesson = require("../Models/lesson");
const Quiz = require("../Models/quiz");
const Assignment = require("../Models/Assignment");
const { verifyToken } = require("../middleware/authMiddleware");

// GET /api/search/all?q=keyword
router.get("/all", verifyToken, async (req, res) => {
  const q = req.query.q ? req.query.q.trim() : "";
  if (!q) return res.json({ courses: [], lessons: [], quizzes: [], assignments: [] });
  try {
    const courses = await Course.find({
      $or: [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { category: { $regex: q, $options: "i" } },
      ],
    }).limit(10);

    const lessons = await Lesson.find({
      $or: [
        { title: { $regex: q, $options: "i" } },
        { contentType: { $regex: q, $options: "i" } },
      ],
    }).limit(10);

    // Search Quizzes
    const quizzes = await Quiz.find({
      $or: [
        { title: { $regex: q, $options: "i" } },
      ],
    }).limit(10);

    // Search Assignments
    const assignments = await Assignment.find({
      $or: [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ],
    }).limit(10);

    res.json({ courses, lessons, quizzes, assignments });
  } catch (err) {
    res.status(500).json({ message: "Search error", error: err.message });
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const { verifyToken, checkRole } = require("../middleware/authMiddleware");
const User = require("../Models/user");
const { Course } = require("../Models/course"); // <-- FIXED
const Enrollment = require("../Models/Enrollment");
const QuizSubmission = require("../Models/quizSubmission");
const notifyUser = require("../utils/notifyUser");

// ✅ Get Admin Dashboard Data
router.get("/admin-dashboard", verifyToken, checkRole(["admin"]), async (req, res) => {
  try {
    // Get total users
    const totalUsers = await User.countDocuments();
    const totalStudents = await User.countDocuments({ role: "student" });
    const totalTeachers = await User.countDocuments({ role: "teacher" });

    // Get total courses
    const totalCourses = await Course.countDocuments();

    // Get total enrollments
    const totalEnrollments = await Enrollment.countDocuments();

    // Get quiz statistics
    const totalQuizzes = await QuizSubmission.countDocuments();
    const averageScore = await QuizSubmission.aggregate([
      { $group: { _id: null, avgScore: { $avg: "$score" } } }
    ]);

    // Notify the admin
    await notifyUser(req.user.id, `👋 Welcome back to the Admin Dasnboard.`);

    // Send response
    res.status(200).json({
      totalUsers,
      totalStudents,
      totalTeachers,
      totalCourses,
      totalEnrollments,
      totalQuizzes,
      averageScore: averageScore.length > 0 ? averageScore[0].avgScore : 0
    });
  } catch (error) {
    console.error("Error fetching admin dashboard data:", error.message);
    res.status(500).json({ message: "Server Error", error });
  }
});

module.exports = router;

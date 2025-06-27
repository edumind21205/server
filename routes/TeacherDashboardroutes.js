const express = require("express");
const router = express.Router();
const { verifyToken, checkRole } = require("../middleware/authMiddleware");
const User = require("../Models/user");
const { Course } = require("../Models/course"); // Use destructuring for Course
const Enrollment = require("../Models/Enrollment");
const Quiz = require("../Models/quiz"); // Add this if you want to count quizzes
const QuizSubmission = require("../Models/quizSubmission");
const notifyUser = require("../utils/notifyUser");

// ✅ Get Teacher Dashboard Data
router.get("/teacher-dashboard", verifyToken, checkRole(["teacher"]), async (req, res) => {
  try {
    // Get total courses created by this teacher
    const totalCourses = await Course.countDocuments({ createdBy: req.user.id });

    // Get all courses created by this teacher
    const teacherCourses = await Course.find({ createdBy: req.user.id }).select("_id");
    const courseIds = teacherCourses.map(course => course._id);

    // Get total enrollments for teacher's courses
    const totalEnrollments = await Enrollment.countDocuments({ course: { $in: courseIds } });

    // Get total quizzes for teacher's courses
    let totalQuizzes = 0;
    if (Quiz) {
      totalQuizzes = await Quiz.countDocuments({ course: { $in: courseIds } });
    }

    // Get average quiz score for teacher's quizzes (if QuizSubmission has course or quiz with course)
    let averageScore = 0;
    if (QuizSubmission) {
      const averageScoreAgg = await QuizSubmission.aggregate([
        { $match: { course: { $in: courseIds } } },
        { $group: { _id: null, avgScore: { $avg: "$score" } } }
      ]);
      averageScore = averageScoreAgg.length > 0 ? averageScoreAgg[0].avgScore : 0;
    }

    // Get total unique students in teacher's courses
    const uniqueStudentIds = await Enrollment.distinct("student", { course: { $in: courseIds } });
    const totalStudents = uniqueStudentIds.length;

    // Notify the teacher
    await notifyUser(req.user.id, `👋 Welcome back to your Teacher Dashboard.`);

    // Send response
    res.status(200).json({
      totalCourses,
      totalEnrollments,
      totalQuizzes,
      averageScore,
      totalStudents
    });
  } catch (error) {
    console.error("Error fetching teacher dashboard data:", error.message);
    res.status(500).json({ message: "Server Error", error });
  }
});

module.exports = router;
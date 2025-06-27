const express = require("express");
const router = express.Router();
const { verifyToken, checkRole } = require("../middleware/authMiddleware");
const Enrollment = require("../Models/Enrollment");
const QuizSubmission = require("../Models/quizSubmission");
const Course = require("../Models/course");
const notifyUser = require("../utils/notifyUser");
const jwt = require("jsonwebtoken");


// ✅ Get Student Dashboard Data
router.get("/student-dashboard", verifyToken, checkRole(["student"]), async (req, res) => {
  try {
    // Get enrolled courses
    const enrollments = await Enrollment.find({ student: req.user.id }).populate("course");

    // Get quiz submissions
    const quizSubmissions = await QuizSubmission.find({ student: req.user.id }).populate("quiz");

    // Calculate stats for cards
    const coursesEnrolled = enrollments.length;
    const coursesCompleted = enrollments.filter(e => e.progress === 100).length;
    // If you have a Certificate model, count certificates, else set to 0 or calculate as needed
    const certificates = enrollments.filter(e => e.progress === 100).length;

    // Optionally keep progress and quizResults for other dashboard sections
    const progress = enrollments.map((enroll) => ({
      course: enroll.course.title,
      progress: enroll.progress,
    }));

    const quizResults = quizSubmissions.map((quiz) => ({
      quizTitle: quiz.quiz.title,
      score: quiz.score,
    }));

    // Add id field to each course in enrollments for frontend compatibility
    const enrollmentsWithCourseId = enrollments.map(e => {
      const course = e.course && e.course.toObject ? e.course.toObject() : e.course;
      if (course && course._id) course.id = course._id;
      return {
        ...e.toObject(),
        course,
      };
    });

    // Compute additional stats for frontend
    const activeEnrollments = enrollmentsWithCourseId.filter(e => e.progress < 100).length;
    const quizzesAttempted = quizResults.length;
    const averageScore =
      quizResults.length > 0
        ? quizResults.reduce((sum, q) => sum + (q.score || 0), 0) / quizResults.length
        : 0;

    await notifyUser(req.user.id, `👋 Welcome back to your Student Dashboard.`);

    res.status(200).json({
      coursesEnrolled: coursesEnrolled ?? 0,
      coursesCompleted: coursesCompleted ?? 0,
      certificates: certificates ?? 0,
      progress: progress ?? [],
      quizResults: quizResults ?? [],
      enrollments: enrollmentsWithCourseId ?? [],
      activeEnrollments: activeEnrollments ?? 0,
      quizzesAttempted: quizzesAttempted ?? 0,
      averageScore: averageScore ?? 0
    });
  } catch (error) {
    console.error("Error fetching student dashboard data:", error.message);
    res.status(500).json({ message: "Server Error", error });
  }
});

module.exports = router;

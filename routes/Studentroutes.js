const express = require("express");
const router = express.Router();
const { verifyToken, checkRole } = require("../middleware/authMiddleware");
const Enrollment = require("../Models/Enrollment");
const QuizSubmission = require("../Models/quizSubmission");
const Course = require("../Models/course");
const notifyUser = require("../utils/notifyUser");

// ✅ Get Student Dashboard Data
router.get("/courses", verifyToken, checkRole(["student"]), async (req, res) => {
  try {
    // Get user info (basic)
    const user = req.user;

    // Get all enrollments for the logged-in student
    const enrollments = await Enrollment.find({ student: user.id }).populate({
      path: "course",
      populate: [
        { path: "lessons", select: "title _id" },
        { path: "quizzes", select: "title _id" }
      ]
    });

    // Get all quiz submissions for this student
    const quizSubmissions = await QuizSubmission.find({ student: user.id });

    // Build the dashboard data
    const courses = enrollments.map(enroll => {
      const course = enroll.course;
      // Lessons breakdown
      const lessons = (course.lessons || []).map(lesson => ({
        lessonId: lesson._id,
        title: lesson.title,
        // You may want to add lesson completion status if tracked elsewhere
        status: "unknown" // Placeholder, update if you have lesson progress tracking
      }));
      // Quizzes breakdown
      const quizzes = (course.quizzes || []).map(quiz => {
        const submission = quizSubmissions.find(qs => String(qs.quiz) === String(quiz._id));
        return {
          quizId: quiz._id,
          title: quiz.title,
          completed: !!submission,
          score: submission ? submission.score : null
        };
      });
      // Course progress (from enrollment)
      return {
        courseId: course._id,
        title: course.title,
        description: course.description,
        progress: enroll.progress,
        enrolledAt: enroll.createdAt,
        lessons,
        quizzes
      };
    });

    // await notifyUser(user.id, `👋 Welcome back to your Student Dashboard.`);

    res.status(200).json({
      user: {
        id: user.id,
        role: user.role
        // Add more user info if needed
      },
      courses
    });
  } catch (error) {
    console.error("Error fetching student dashboard data:", error.message);
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Get all courses (with lessons) the student is enrolled in
router.get("/enrolled-courses", verifyToken, checkRole(["student"]), async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ student: req.user.id }).populate({
      path: "course",
      populate: { path: "lessons", select: "title _id contentType contentURL" }
    });

    // Map to only include course _id, title, description, and lessons
    const courses = enrollments
      .filter(e => e.course) // filter out if course is missing
      .map(e => ({
        _id: e.course._id,
        title: e.course.title,
        description: e.course.description,
        lessons: (e.course.lessons || []).map(lesson => ({
          _id: lesson._id,
          title: lesson.title,
          contentType: lesson.contentType,
          contentURL: lesson.contentURL
        }))
      }));

    res.json(courses);
  } catch (error) {
    console.error("Error fetching enrolled courses:", error.message);
    res.status(500).json({ message: "Server Error", error });
  }
});

module.exports = router;

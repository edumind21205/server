const express = require("express");
const router = express.Router();
const Enrollment = require("../Models/Enrollment");
const { Course } = require("../Models/course");
const { verifyToken, checkRole } = require("../middleware/authMiddleware"); // Correct import
const notifyUser = require("../utils/notifyUser");
const Progress = require("../Models/Progress"); // Import Progress model
const Payment = require("../Models/payment"); // Import Payment model

// Middleware for auth & roles
router.use(verifyToken);

// 🟢 Enroll in a Course (Only Students)
router.post("/:courseId", verifyToken, checkRole(["student"]), async (req, res) => {
  try {
    const { courseId } = req.params;

    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    // Check if student is already enrolled
    const existingEnrollment = await Enrollment.findOne({
      student: req.user.id,
      course: courseId,
    });

    if (existingEnrollment) {
      return res.status(400).json({ message: "Already enrolled in this course" });
    }

    // Create new enrollment
    const newEnrollment = new Enrollment({
      student: req.user.id,
      course: courseId,
    });

    await newEnrollment.save();

    // Notify the user
    await notifyUser(req.user.id, `You have enrolled in the course: ${course.title}`);

    res.status(201).json({ message: "Enrollment successful!", enrollment: newEnrollment });
  } catch (error) {
    console.error("ENROLL ERROR:", error); // Add this line
    res.status(500).json({ message: "Error enrolling in course", error: error.message });
  }
});

// 🟡 Get All Enrollments for a Student (updated to match Studentroutes.js logic)
router.get("/enroll-courses",verifyToken, checkRole(["student"]), async (req, res) => {
  try {
    // Get user info (basic)
    const user = req.user;

    // Get all enrollments for the logged-in student
    const enrollments = await Enrollment.find({ student: user.id }).populate({
      path: "course",
      populate: [
        { path: "lessons", select: "title _id type duration contentURL" },
        { path: "quizzes", select: "title _id" }
      ]
    });

    // Get all quiz submissions for this student
    const QuizSubmission = require("../Models/quizSubmission");
    const quizSubmissions = await QuizSubmission.find({ student: user.id });

    // Get all progress records for this student
    const progresses = await Progress.find({ userId: user.id });
    const progressMap = {};
    progresses.forEach(p => {
      progressMap[String(p.courseId)] = p.completedLessons.map(l => String(l));
    });

    // Build the dashboard data
    const courses = [];
    for (const enroll of enrollments.filter(enroll => enroll.course)) {
      const course = enroll.course;
      // Lessons breakdown
      const completedLessons = progressMap[String(course._id)] || [];
      const lessons = (course.lessons || []).map(lesson => ({
        lessonId: lesson._id,
        title: lesson.title,
        type: lesson.type,
        duration: lesson.duration,
        url: lesson.contentURL,
        status: completedLessons.includes(String(lesson._id)) ? "completed" : "pending"
      }));
      // Quizzes breakdown (show all quizzes, mark submitted if student has submission)
      const quizzes = Array.isArray(course.quizzes) ? course.quizzes.map(quiz => {
        const submission = quizSubmissions.find(qs => String(qs.quiz) === String(quiz._id));
        return {
          quizId: quiz._id,
          title: quiz.title,
          submitted: !!submission,
          score: submission ? submission.score : null
        };
      }) : [];
      // Course progress (from enrollment)
      // Debug log for createdAt
      // console.log("Enrollment createdAt for course", course.title, ":", enroll.createdAt);
      // Fallback for enrolledAt if createdAt is missing (for old records)
      let enrolledAt = enroll.createdAt;
      if (!enrolledAt && enroll._id && typeof enroll._id.getTimestamp === "function") {
        enrolledAt = enroll._id.getTimestamp();
      }
      // Check payment status
      let paymentStatus = "free";
      if (typeof course.price === "number" && course.price > 0) {
        const payment = await Payment.findOne({ student: user.id, course: course._id });
        paymentStatus = payment ? "paid" : "unpaid";
      }
      courses.push({
        courseId: course._id,
        title: course.title,
        description: course.description,
        picture: course.picture || "", // Include picture
        enrolledAt, // always send a value
        progress: typeof enroll.progress === "number" ? enroll.progress : 0,
        lessons,
        quizzes, // always an array
        paymentStatus,
        price: course.price
      });
    }

    res.status(200).json({
      user: {
        id: user.id,
        role: user.role
      },
      courses
    });
  } catch (error) {
    console.error("Error fetching student enrolled courses:", error.message);
    res.status(500).json({ message: "Server Error", error });
  }
});

// 🔵 Get All Students Enrolled in a Course (For Teachers/Admins)
router.get("/course/:courseId", checkRole(["teacher", "admin"]), async (req, res) => {
  try {
    const { courseId } = req.params;
    const enrollments = await Enrollment.find({ course: courseId }).populate("student", "name email");
    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ message: "Error fetching course enrollments", error });
  }
});

// 🟠 Update Progress (Students Updating Their Progress)
router.put("/:courseId/progress", checkRole(["student"]), async (req, res) => {
  try {
    const { courseId } = req.params;
    const { progress } = req.body;

    // Validate progress percentage
    if (progress < 0 || progress > 100) {
      return res.status(400).json({ message: "Progress must be between 0 and 100" });
    }

    // Find enrollment
    const enrollment = await Enrollment.findOne({ student: req.user.id, course: courseId });
    if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });

    // Update progress
    enrollment.progress = progress;
    await enrollment.save();

    res.json({ message: "Progress updated successfully!", enrollment });
  } catch (error) {
    res.status(500).json({ message: "Error updating progress", error });
  }
});

// 🔴 Unenroll from a Course
router.delete("/:courseId", checkRole(["student"]), async (req, res) => {
  try {
    const { courseId } = req.params;

    const enrollment = await Enrollment.findOneAndDelete({
      student: req.user.id,
      course: courseId,
    });

    if (!enrollment) return res.status(404).json({ message: "Not enrolled in this course" });

    res.json({ message: "Unenrolled successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error unenrolling", error });
  }
});

// 🟡 Get All Quizzes for All Courses for a Student
router.get("/all-quizzes", verifyToken, checkRole(["student"]), async (req, res) => {
  try {
    // Get all courses
    const courses = await Course.find({}).populate({
      path: "quizzes",
      select: "title _id createdAt"
    });

    // Get all quiz submissions for this student
    const QuizSubmission = require("../Models/quizSubmission");
    const quizSubmissions = await QuizSubmission.find({ student: req.user.id });
    const submissionMap = {};
    quizSubmissions.forEach(sub => {
      submissionMap[String(sub.quiz)] = sub;
    });

    // Build quizzes array
    let quizzes = [];
    courses.forEach(course => {
      (course.quizzes || []).forEach(quiz => {
        const submission = submissionMap[String(quiz._id)];
        quizzes.push({
          quizId: String(quiz._id),
          title: quiz.title,
          courseId: String(course._id), // Ensure courseId is a string
          courseTitle: course.title,
          createdAt: quiz.createdAt,
          completed: !!submission,
          score: submission ? submission.score : null,
          submittedAt: submission ? submission.createdAt : null
        });
      });
    });

    res.json({ quizzes });
  } catch (error) {
    console.error("Error fetching all quizzes for student:", error.message);
    res.status(500).json({ message: "Server Error", error });
  }
});

// 🟢 Check if student is already enrolled in a course (for frontend checks)
router.get("/check/:courseId", verifyToken, checkRole(["student"]), async (req, res) => {
  try {
    const { courseId } = req.params;
    const existingEnrollment = await Enrollment.findOne({
      student: req.user.id,
      course: courseId,
    });
    res.json({ enrolled: !!existingEnrollment });
  } catch (error) {
    res.status(500).json({ message: "Error checking enrollment", error: error.message });
  }
});

module.exports = router;

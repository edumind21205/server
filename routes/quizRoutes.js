const express = require("express");
const router = express.Router();
const { verifyToken, checkRole } = require("../middleware/authMiddleware");
const Quiz = require("../Models/quiz");
const QuizSubmission = require("../Models/quizSubmission");
const { quizValidation } = require("../validators/quizValidator");
const { validationResult } = require("express-validator");
const notifyUser = require("../utils/notifyUser");

// ✅ Create a Quiz (Admin Only)
router.post("/create", verifyToken, checkRole(["teacher"]), quizValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { course, title, questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "Questions are required and must be an array" });
    }

    // Validate each question
    for (const question of questions) {
      if (!question.questionText || !question.options || question.options.length < 2 || !question.correctAnswer) {
        return res.status(400).json({
          message: "Each question must have a questionText, at least two options, and a correctAnswer",
        });
      }
    }

    const newQuiz = new Quiz({ course, title, questions });

    await newQuiz.save();
    res.status(201).json({ message: "Quiz created successfully", quiz: newQuiz });
  } catch (error) {
    console.error("Error creating quiz:", error.message);
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Get Quizzes for a Course
router.get("/course/:courseId", verifyToken, async (req, res) => {
  try {
    // Populate questions for each quiz
    const quizzes = await Quiz.find({ course: req.params.courseId }).lean();
    res.status(200).json(quizzes);
  } catch (error) {
    console.error("Error fetching quizzes:", error.message);
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Delete a Quiz (Admin Only)
router.delete("/delete-quiz/:quizId", verifyToken, checkRole(["teacher"]), async (req, res) => {
  try {
    const quiz = await Quiz.findByIdAndDelete(req.params.quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    res.status(200).json({ message: "Quiz deleted successfully" });
  } catch (error) {
    console.error("Error deleting quiz:", error.message);
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Submit Quiz Answers (Student)
router.post("/submit-quiz/:quizId", verifyToken, async (req, res) => {
  try {
    const { answers } = req.body;

    // Validate answers array
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ message: "Answers must be an array" });
    }

    // Find the quiz
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    // Validate the number of answers
    if (answers.length !== quiz.questions.length) {
      return res.status(400).json({ message: "Answers do not match the number of questions" });
    }

    // Calculate the score and include questionId in answers
    let score = 0;
    const submissionAnswers = answers.map((answer, index) => {
      const question = quiz.questions[index];
      if (answer.selectedOption === question.correctAnswer) {
        score += 1;
      }
      return {
        questionId: question._id, // Include questionId
        selectedOption: answer.selectedOption,
      };
    });

    // Save the quiz submission
    const newSubmission = new QuizSubmission({
      quiz: req.params.quizId,
      student: req.user.id,
      answers: submissionAnswers,
      score,
    });

    await newSubmission.save();

    // Notify the user
    await notifyUser(req.user.id, `✅ Your quiz for "${quiz.title}" has been submitted.`);

    res.status(201).json({ message: "Quiz submitted successfully", score });
  } catch (error) {
    console.error("Error submitting quiz:", error.message, error.stack);
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Get Student Quiz Submissions
router.get("/my-submissions", verifyToken, async (req, res) => {
  try {
    const submissions = await QuizSubmission.find({ student: req.user.id }).populate("quiz");
    res.status(200).json(submissions);
  } catch (error) {
    console.error("Error fetching submissions:", error.message);
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Get All Available Quizzes for Student's Enrolled Courses
router.get("/student/all", verifyToken, checkRole(["student"]), async (req, res) => {
  try {
    const Enrollment = require("../Models/Enrollment");
    // Find all enrollments for the logged-in student
    const enrollments = await Enrollment.find({ student: req.user.id }).populate("course");
    const courseIds = enrollments.map(e => e.course._id);

    // Fetch all quizzes for these courses
    const quizzes = await Quiz.find({ course: { $in: courseIds } }).populate("course");

    // Fetch submissions to mark completed quizzes and get scores
    const QuizSubmission = require("../Models/quizSubmission");
    const submissions = await QuizSubmission.find({ student: req.user.id });
    const submissionMap = {};
    submissions.forEach(sub => { submissionMap[String(sub.quiz)] = sub; });

    // Build quiz list with score for completed quizzes
    const quizList = quizzes.map(q => ({
      quizId: q._id,
      title: q.title,
      courseId: q.course._id,
      courseTitle: q.course.title,
      createdAt: q.createdAt,
      completed: !!submissionMap[String(q._id)],
      score: submissionMap[String(q._id)] ? submissionMap[String(q._id)].score : null,
      submittedAt: submissionMap[String(q._id)] ? submissionMap[String(q._id)].createdAt : null
    }));

    res.status(200).json({ quizzes: quizList });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Save Quiz Progress (Partial)
router.post("/save-progress/:quizId", verifyToken, checkRole(["student"]), async (req, res) => {
  try {
    const { answers } = req.body;
    const QuizProgress = require("../Models/quizProgress");
    let progress = await QuizProgress.findOneAndUpdate(
      { quiz: req.params.quizId, student: req.user.id },
      { answers, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.status(200).json({ message: "Progress saved", progress });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Get Quiz Progress
router.get("/progress/:quizId", verifyToken, checkRole(["student"]), async (req, res) => {
  try {
    const QuizProgress = require("../Models/quizProgress");
    const progress = await QuizProgress.findOne({ quiz: req.params.quizId, student: req.user.id });
    res.status(200).json({ progress });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Get All Quiz Results for Student
router.get("/student/results", verifyToken, checkRole(["student"]), async (req, res) => {
  try {
    const submissions = await QuizSubmission.find({ student: req.user.id })
      .populate("quiz")
      .sort({ createdAt: -1 });
    const results = submissions.map(sub => ({
      quizId: sub.quiz._id,
      quizTitle: sub.quiz.title,
      courseId: sub.quiz.course,
      score: sub.score,
      submittedAt: sub.createdAt
    }));
    res.status(200).json({ results });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Unified Quiz Dashboard for Student
router.get("/student/dashboard", verifyToken, checkRole(["student"]), async (req, res) => {
  try {
    const Enrollment = require("../Models/Enrollment");
    const Quiz = require("../Models/quiz");
    const QuizSubmission = require("../Models/quizSubmission");

    // Get all enrolled courses
    const enrollments = await Enrollment.find({ student: req.user.id }).populate("course");
    const courseIds = enrollments.map(e => e.course._id);

    // Get all quizzes for these courses
    const quizzes = await Quiz.find({ course: { $in: courseIds } }).populate("course");

    // Get all submissions for this student
    const submissions = await QuizSubmission.find({ student: req.user.id });

    // Map quizId to submission (use string keys)
    const submissionMap = {};
    submissions.forEach(sub => { submissionMap[String(sub.quiz)] = sub; });

    // Build dashboard data
    const quizCards = quizzes.map(q => ({
      quizId: q._id,
      title: q.title,
      courseId: q.course._id,
      courseTitle: q.course.title,
      createdAt: q.createdAt,
      completed: !!submissionMap[String(q._id)],
      score: submissionMap[String(q._id)]?.score || null,
      submittedAt: submissionMap[String(q._id)]?.createdAt || null
    }));

    res.status(200).json({ quizCards });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Get Quiz by ID (for detail page)
router.get("/id/:id", verifyToken, async (req, res) => {
  try {
    // Only populate course, not createdBy (since not in schema)
    const quiz = await Quiz.findById(req.params.id)
      .populate("course", "title")
      .lean();

    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    res.status(200).json({ success: true, quiz });
  } catch (error) {
    // Improved error logging
    console.error("Error fetching quiz by ID:", error.message, error.stack);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

module.exports = router;
module.exports = router;

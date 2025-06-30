const express = require("express");
const router = express.Router();
const Question = require("../Models/question");
const { Course } = require("../Models/course");
const Enrollment = require("../Models/Enrollment");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");

// STUDENT: Ask a question about a lesson/course
router.post("/ask", verifyToken, checkRole(["student"]), async (req, res) => {
  try {
    const { courseId, lessonId, text } = req.body;

    // Check enrollment
    const enrolled = await Enrollment.findOne({ student: req.user.id, course: courseId });
    if (!enrolled) return res.status(403).json({ message: "Not enrolled in this course" });

    const question = new Question({
      askedBy: req.user.id,
      course: courseId,
      lesson: lessonId || null,
      text,
    });
    await question.save();
    // Populate for frontend consistency
    await question.populate([
      { path: "askedBy", select: "name email _id" },
      { path: "course" }
    ]);
    res.status(201).json({ message: "Question posted", question });
  } catch (err) {
    res.status(500).json({ message: "Error posting question", error: err.message });
  }
});

// TEACHER: Answer a question from your course
router.post("/answer/:questionId", verifyToken, checkRole(["teacher","admin"]), async (req, res) => {
  try {
    const { text } = req.body;
    const question = await Question.findById(req.params.questionId).populate("course");
    if (!question) return res.status(404).json({ message: "Question not found" });

    // Allow teacher to answer only their own course, but admin can answer any
    if (
      req.user.role === "teacher" &&
      question.course.createdBy.toString() !== req.user.id
    ) {
      return res.status(403).json({ message: "You can't answer this question" });
    }

    question.answers.push({ answeredBy: req.user.id, text });
    question.status = "answered";
    await question.save();
    // Populate answers for frontend
    await question.populate([
      { path: "askedBy", select: "name email _id" },
      { path: "course" },
      { path: "answers.answeredBy", select: "name email _id" }
    ]);
    res.status(200).json({ message: "Answered", question });
  } catch (err) {
    res.status(500).json({ message: "Error answering question", error: err.message });
  }
});

// ADMIN/TEACHER/STUDENT: Get all questions with filters
router.get("/all", verifyToken, checkRole(["admin", "teacher", "student"]), async (req, res) => {
  try {
    const questions = await Question.find()
      .populate([
        { path: "askedBy", select: "name email _id" },
        { path: "course" },
        { path: "answers.answeredBy", select: "name email _id" }
      ])
      .sort({ createdAt: -1 });
    res.status(200).json(questions);
  } catch (err) {
    res.status(500).json({ message: "Error fetching questions", error: err.message });
  }
});

// STUDENT: Edit their own question
router.put("/edit/:id", verifyToken, checkRole(["student"]), async (req, res) => {
  try {
    const { text } = req.body;
    const question = await Question.findById(req.params.id);
    if (!question) return res.status(404).json({ message: "Question not found" });
    if (question.askedBy.toString() !== req.user.id)
      return res.status(403).json({ message: "You can only edit your own question" });
    question.text = text;
    await question.save();
    await question.populate([
      { path: "askedBy", select: "name email _id" },
      { path: "course" },
      { path: "answers.answeredBy", select: "name email _id" }
    ]);
    res.status(200).json({ message: "Question updated", question });
  } catch (err) {
    res.status(500).json({ message: "Error editing question", error: err.message });
  }
});

// STUDENT/ADMIN: Soft delete a question (student can delete their own)
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) return res.status(404).json({ message: "Question not found" });

    // Allow admin or student who asked the question
    if (
      req.user.role === "admin" ||
      (req.user.role === "student" && question.askedBy.toString() === req.user.id)
    ) {
      await Question.findByIdAndUpdate(req.params.id, { deleted: true });
      return res.status(200).json({ message: "Question soft deleted" });
    } else {
      return res.status(403).json({ message: "Not authorized to delete this question" });
    }
  } catch (err) {
    res.status(500).json({ message: "Error deleting", error: err.message });
  }
});

module.exports = router;

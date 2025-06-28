const express = require("express");
const Submission = require("../Models/AssignmentSubmission");
const Assignment = require("../Models/Assignment");
const jwt = require("jsonwebtoken");
const User = require("../Models/user.js");
const router = express.Router();

// Middleware to verify user token (CommonJS style)
const verifyToken = async (req, res, next) => {
  const authHeader = req.header("Authorization");
  if (!authHeader) return res.status(401).json({ message: "Access Denied" });
  const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(verified.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    req.user = { id: user._id.toString(), role: user.role };
    next();
  } catch (err) {
    res.status(400).json({ message: "Invalid Token" });
  }
};

const checkRole = (roles) => (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(403).json({ message: "Access Forbidden" });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Access Forbidden" });
  }
  next();
};

// POST: Student submits an assignment
router.post("/", verifyToken, checkRole(["student"]), async (req, res) => {
  try {
    const { assignment, submittedFileUrl } = req.body;

    // Check for duplicate submission
    const existing = await Submission.findOne({ assignment, student: req.user.id });
    if (existing) {
      return res.status(400).json({ success: false, message: "You have already submitted this assignment." });
    }

    const submission = await Submission.create({
      assignment,
      submittedFileUrl,
      student: req.user.id,
    });

    res.status(201).json({ success: true, submission });
  } catch (error) {
    res.status(500).json({ success: false, message: "Submission failed", error });
  }
});

// POST: Student uploads a file for assignment submission (Cloudinary)
router.post("/upload", verifyToken, checkRole(["student"]), require("../utils/upload").single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }
  // If you want to upload to Cloudinary here, do:
  /*
  const cloudinary = require("../utils/cloudinary");
  let uploadResult;
  if (req.file.mimetype === "application/pdf") {
    uploadResult = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "raw",
      folder: "edumids/assignments"
    });
  } else {
    uploadResult = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "auto",
      folder: "edumids/assignments"
    });
  }
  return res.status(200).json({ success: true, fileUrl: uploadResult.secure_url });
  */
  res.status(200).json({ success: true, fileUrl: req.file.path });
});

// GET: Student gets all their submissions
router.get("/student", verifyToken, checkRole(["student"]), async (req, res) => {
  try {
    const submissions = await Submission.find({ student: req.user.id }).populate("assignment");
    res.json({ success: true, submissions });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching submissions", error });
  }
});

// GET: Teacher gets all submissions for a specific assignment
router.get("/assignment/:assignmentId", verifyToken, checkRole(["teacher"]), async (req, res) => {
  try {
    const { assignmentId } = req.params;
    console.log("Fetching submissions for assignmentId:", assignmentId);
    const submissions = await Submission.find({ assignment: assignmentId }).populate("student", "name email");
    console.log("Found submissions:", submissions.length);
    res.json({ success: true, submissions });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching submissions", error });
  }
});

// PUT: Grade a submission
router.put("/:id/grade", verifyToken, checkRole(["teacher"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { marksObtained, feedback } = req.body;

    const submission = await Submission.findByIdAndUpdate(
      id,
      { marksObtained, feedback },
      { new: true }
    );

    res.json({ success: true, submission });
  } catch (error) {
    res.status(500).json({ success: false, message: "Grading failed", error });
  }
});

// GET: Student gets all assignments for their enrolled courses with submission status
router.get("/student/assignments", verifyToken, checkRole(["student"]), async (req, res) => {
  try {
    // Get all enrollments for the student
    const Enrollment = require("../Models/Enrollment");
    const { Course } = require("../Models/course");
    const Assignment = require("../Models/Assignment");
    const enrollments = await Enrollment.find({ student: req.user.id });
    const courseIds = enrollments.map(e => e.course);

    // Get all assignments for these courses
    // Populate course details for each assignment
    const assignments = await Assignment.find({ course: { $in: courseIds } })
      .populate("course", "title")
      .lean();

    // Get all submissions by this student
    const submissions = await Submission.find({ student: req.user.id });
    const submissionMap = {};
    submissions.forEach(sub => {
      submissionMap[sub.assignment.toString()] = sub;
    });

    // Group assignments by course, and attach submission info
    const assignmentsByCourse = {};
    assignments.forEach(assignment => {
      const courseId = assignment.course._id ? assignment.course._id.toString() : assignment.course.toString();
      if (!assignmentsByCourse[courseId]) {
        assignmentsByCourse[courseId] = {
          courseId,
          courseTitle: assignment.course.title || "",
          assignments: []
        };
      }
      const submission = submissionMap[assignment._id.toString()] || null;
      assignmentsByCourse[courseId].assignments.push({
        ...assignment,
        submitted: !!submission,
        submissionId: submission ? submission._id : null,
        marksObtained: submission ? submission.marksObtained : null,
        feedback: submission ? submission.feedback : null,
        submittedAt: submission ? submission.submittedAt : null,
      });
    });

    // Convert assignmentsByCourse object to array for easier frontend rendering
    const assignmentsByCourseArr = Object.values(assignmentsByCourse);

    res.json({ success: true, assignmentsByCourse: assignmentsByCourseArr });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching assignments", error });
  }
});

module.exports = router;

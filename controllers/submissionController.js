import Submission from "../Models/Submission.js";
import Assignment from "../Models/Assignment.js";

// POST: Student submits an assignment
export const submitAssignment = async (req, res) => {
  try {
    const { assignment, submittedFileUrl } = req.body;

    // Check for duplicate submission
    const existing = await Submission.findOne({ assignment, student: req.user._id });
    if (existing) {
      return res.status(400).json({ success: false, message: "You have already submitted this assignment." });
    }

    const submission = await Submission.create({
      assignment,
      submittedFileUrl,
      student: req.user._id,
    });

    res.status(201).json({ success: true, submission });
  } catch (error) {
    res.status(500).json({ success: false, message: "Submission failed", error });
  }
};

// GET: Student gets all their submissions
export const getStudentSubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find({ student: req.user._id }).populate("assignment");
    res.json({ success: true, submissions });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching submissions", error });
  }
};

// GET: Teacher gets all submissions for a specific assignment
export const getSubmissionsForAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const submissions = await Submission.find({ assignment: assignmentId }).populate("student", "name email");
    res.json({ success: true, submissions });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching submissions", error });
  }
};

// PUT: Grade a submission
export const gradeSubmission = async (req, res) => {
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
};

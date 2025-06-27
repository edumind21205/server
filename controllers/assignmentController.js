import Assignment from "../Models/Assignment.js";

// POST: Create assignment
export const createAssignment = async (req, res) => {
  try {
    const { title, description, course, deadline, totalMarks, attachmentUrl } = req.body;

    const assignment = await Assignment.create({
      title,
      description,
      course,
      deadline,
      totalMarks,
      attachmentUrl,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, assignment });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error creating assignment", error });
  }
};

// GET: Get assignments by course
export const getAssignmentsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const assignments = await Assignment.find({ course: courseId }).sort({ createdAt: -1 });
    res.json({ success: true, assignments });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch assignments", error });
  }
};

// GET: Get a single assignment
export const getSingleAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: "Assignment not found" });
    res.json({ success: true, assignment });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching assignment", error });
  }
};

// PUT: Update assignment
export const updateAssignment = async (req, res) => {
  try {
    const updated = await Assignment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, assignment: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating assignment", error });
  }
};

// DELETE: Delete assignment
export const deleteAssignment = async (req, res) => {
  try {
    await Assignment.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Assignment deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting assignment", error });
  }
};

const express = require("express");
const router = express.Router();
const { verifyToken, checkRole } = require("../middleware/authMiddleware");
const Lesson = require("../Models/lesson");
const {Course} = require("../Models/course"); // <-- Uncommented to fix missing Course reference
const User = require("../Models/user");
const Payment = require("../Models/payment"); // <-- Added to fix missing Payment reference

// ✅ Create a Course
// router.post("/create-course", verifyToken, checkRole(["admin"]), async (req, res) => {
//   try {
//     const { title, description, createdBy } = req.body;

//     // Validate createdBy (instructor)
//     const instructorUser = await User.findById(createdBy);
//     if (!instructorUser || instructorUser.role !== "teacher") {
//       return res.status(400).json({ message: "Invalid instructor ID or the user is not a teacher" });
//     }

//     const course = new Course({ title, description, createdBy });
//     await course.save();
//     res.status(201).json({ message: "Course created successfully", course });
//   } catch (error) {
//     res.status(500).json({ message: "Server Error", error });
//   }
// });

// // ✅ Add a Lesson to a Course
// router.post("/lessons", verifyToken, async (req, res) => {
//   try {
//     const { courseId, title, contentType, contentURL } = req.body;

//     // Validate request
//     if (!courseId || !title || !contentType || !contentURL) {
//       return res.status(400).json({ message: "All fields are required" });
//     }

//     // Check if the course exists
//     const course = await Course.findById(courseId);
//     if (!course) {
//       return res.status(404).json({ message: "Course not found" });
//     }

//     // Check if the logged-in user is an admin or the instructor of the course
//     if (course.createdBy.toString() !== req.user.id && req.user.role !== "admin") {
//       return res.status(403).json({ message: "Unauthorized" });
//     }

//     // Create a new lesson
//     const lesson = new Lesson({ courseId, title, contentType, contentURL });
//     await lesson.save();

//     // Add lesson ID to the course's lessons array
//     await Course.findByIdAndUpdate(courseId, { $push: { lessons: lesson._id } });

//     res.status(201).json({ message: "Lesson added successfully", lesson });
//   } catch (error) {
//     res.status(500).json({ message: "Server Error", error });
//   }
// });

// ✅ Update a Course
// router.put("/courses/:id", verifyToken, checkRole(["admin"]), async (req, res) => {
//   try {
//     const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
//     res.status(200).json({ message: "Course updated successfully", course });
//   } catch (error) {
//     res.status(500).json({ message: "Server Error", error });
//   }
// });

// ✅ Delete a Course
router.delete("/courses/:id", verifyToken, checkRole(["admin"]), async (req, res) => {
  try {
    await Course.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Course deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Get All Users (Admin Only)
router.get("/users", verifyToken, checkRole(["admin"]), async (req, res) => {
  try {
    const users = await User.find().select("-password"); // Exclude passwords
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Update User Role (Admin Only)
router.put("/update-user-role/:userId", verifyToken, checkRole(["admin"]), async (req, res) => {
  try {
    const { role } = req.body;
    const updatedUser = await User.findByIdAndUpdate(req.params.userId, { role }, { new: true });

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User role updated successfully", user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Delete a User (Admin Only)
router.delete("/delete-user/:userId", verifyToken, checkRole(["admin"]), async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.userId);
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// GET: Admin payment history (all payments with student and course details)
router.get("/admin-history", verifyToken, checkRole(["admin"]), async (req, res) => {
  try {
    // Populate student and course details
    const payments = await Payment.find()
      .populate("student", "name email")
      .populate("course", "title description price category");
    res.status(200).json(payments);
  } catch (error) {
    console.error("Error fetching payment history:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET: Admin report - all courses, teachers, enrollments, completions, and certificates
router.get("/courses-report", verifyToken, checkRole(["admin"]), async (req, res) => {
  try {
    // Get all courses with teacher info
    const courses = await Course.find().populate("createdBy", "name email role");
    // Get all enrollments
    const Enrollment = require("../Models/Enrollment");
    const enrollments = await Enrollment.find().populate("student", "name email");
    // Group enrollments by course
    const enrollMap = {};
    const completeMap = {};
    const certMap = {};
    enrollments.forEach(e => {
      // Defensive: skip if enrollment or course/student is missing
      if (!e || !e.course) return;
      const courseId = String(e.course);
      if (!enrollMap[courseId]) enrollMap[courseId] = [];
      enrollMap[courseId].push(e);
      // Completed if progress 100
      if (e.progress === 100) {
        if (!completeMap[courseId]) completeMap[courseId] = [];
        completeMap[courseId].push(e);
      }
      // Certificate issued
      if (e.certificateIssued) {
        if (!certMap[courseId]) certMap[courseId] = [];
        certMap[courseId].push(e);
      }
    });
    // Build report
    const report = courses.map(course => {
      const courseId = String(course._id);
      const enrolled = enrollMap[courseId] || [];
      const completed = completeMap[courseId] || [];
      const certified = certMap[courseId] || [];
      return {
        courseId: course._id,
        title: course.title,
        description: course.description,
        category: course.category,
        price: course.price,
        teacher: course.createdBy ? { name: course.createdBy.name, email: course.createdBy.email, role: course.createdBy.role } : null,
        totalEnrolled: enrolled.length,
        totalCompleted: completed.length,
        totalCertified: certified.length,
        enrolledStudents: enrolled.map(e => ({
          studentId: e.student?._id || null,
          name: e.student?.name || "Unknown",
          email: e.student?.email || "Unknown",
          progress: e.progress,
          certificateIssued: e.certificateIssued,
          certificateRevoked: e.certificateRevoked
        })),
        completedStudents: completed.map(e => ({
          studentId: e.student?._id || null,
          name: e.student?.name || "Unknown",
          email: e.student?.email || "Unknown",
          progress: e.progress
        })),
        certifiedStudents: certified.map(e => ({
          studentId: e.student?._id || null,
          name: e.student?.name || "Unknown",
          email: e.student?.email || "Unknown",
          progress: e.progress
        }))
      };
    });
    res.status(200).json({ report });
  } catch (error) {
    console.error("Error in /courses-report:", error); // Log the error for debugging
    res.status(500).json({ message: "Server Error in courses-report", error: error.message });
  }
});

// ✅ Get current user info (role, name, email, etc.)
router.get("/user/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

module.exports = router;

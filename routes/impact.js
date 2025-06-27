const express = require("express");
const router = express.Router();
const User = require("../Models/user");
const { Course } = require("../Models/course");

// GET /api/impact - Website statistics
router.get("/data", async (req, res) => {
  try {
    const students = await User.countDocuments({ role: "student" });
    const instructors = await User.countDocuments({ role: "teacher" });
    const courses = await Course.countDocuments();
    res.json({
      report: [
        {
          students,
          instructors,
          courses
        }
      ]
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

module.exports = router;

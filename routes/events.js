const express = require("express");
const router = express.Router();
const sendEmail = require("../utils/sendEmail");
const User = require("../models/User"); // Adjust path as needed

// ...existing code...

router.post("/add", async (req, res) => {
  try {
    // ...existing logic to add event...

    // Notify all students
    const students = await User.find({ role: "student" }, "email");
    const emails = students.map((s) => s.email).filter(Boolean);

    // Compose email
    const { title, date, type } = req.body;
    const subject = "New Calendar Event Added";
    const text = `A new event has been added to the calendar:\n\nTitle: ${title}\nDate: ${date}\nType: ${type}\n\nPlease check your dashboard for details.`;

    // Send email to all students
    for (const email of emails) {
      await sendEmail(email, subject, text);
    }

    res.status(200).json({ message: "Event added and students notified." });
  } catch (err) {
    res.status(500).json({ error: "Failed to add event or send notifications." });
  }
});

// ...existing code...

module.exports = router;
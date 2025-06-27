const express = require("express");
const router = express.Router();
const Notification = require("../Models/notification");
const auth = require("../middleware/auth");
const notifyUser = require("../utils/notifyUser");



// Get all notifications for logged-in user
router.get("/", auth, async (req, res) => {
  try {
    // console.log("Fetching notifications for user:", req.user.id); // Debug log
    const notifications = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 });
    // console.log("Found notifications:", notifications); // Debug log
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: "Error fetching notifications" });
  }
});
// Mark as read
router.patch("/:id/read", auth, async (req, res) => {
  try {
    const updated = await Notification.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
    if (!updated) {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.json({ message: "Marked as read", notification: updated });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ message: "Error marking as read" });
  }
});


module.exports = router;

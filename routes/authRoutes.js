const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../Models/user");
const router = express.Router();
const { verifyToken, checkRole } = require("../middleware/authMiddleware");
const auth = require("../middleware/auth");
const { registerValidation, loginValidation } = require("../validators/authValidator");
const { validationResult } = require("express-validator");
const notifyUser = require("../utils/notifyUser");
const sendEmail = require("../utils/sendEmail");
const crypto = require("crypto");

// 📝 Register a New User
router.post("/register", registerValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, role });

    await user.save();

    // Notify the user
    await notifyUser(user._id, "🎉 Welcome to EduMinds! Start exploring courses now.");

    // Send welcome email
    await sendEmail(
      user.email,
      "Welcome to EduMinds!",
      `Hi ${user.name},\n\nWelcome to EduMinds! Start exploring courses now.\n\nBest regards,\nEduMids Team`
    );

    // Generate JWT token (same as login)
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.status(201).json({
      message: "User registered successfully!",
      token,
      user: { id: user._id, name: user.name, role: user.role }
    });
  } catch (error) {
    console.error("Error registering user:", error.message);
    res.status(500).json({ message: "Server error", error });
  }
});

// 🛡 Login Route
router.post("/login", loginValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

    await notifyUser(user._id, "👋 Welcome back to your Dashboard.");

    // Send login notification email
    await sendEmail(
      user.email,
      "EduMinds Login Notification",
      `Hi ${user.name},\n\nYou have successfully logged in to your EduMinds account.\n\nIf this wasn't you, please contact support immediately.\n\nBest regards,\nEduMids Team`
    );

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.status(200).json({ token, user: { id: user._id, name: user.name, role: user.role } });
  } catch (error) {
    console.error("Error logging in user:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 🛡 Protected Route Example
router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  } catch (error) {
    console.error("Error fetching profile:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 📝 Update Profile (name, email, password)
router.put("/profile", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, password } = req.body;
    const updateFields = {};
    if (name) updateFields.name = name;
    if (email) updateFields.email = email;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.password = hashedPassword;
    }
    // Email conflict check: only if email is changed
    if (email) {
      const user = await User.findById(userId);
      if (user.email !== email) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return res.status(400).json({ message: "Email already in use" });
        }
      }
    }
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true }
    ).select("-password");
    if (!updatedUser) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Error updating profile:", error);
    if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
      return res.status(400).json({ message: "Email already in use" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 🗑 Delete Account
router.delete("/delete-profile", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) return res.status(404).json({ message: "User not found" });

    // Send account deletion email
    await sendEmail(
      deletedUser.email,
      "EduMinds Account Deleted",
      `Hi ${deletedUser.name},\n\nYour EduMinds account has been deleted. We're sorry to see you go!\n\nIf this was a mistake, please contact our support.\n\nBest regards,\nEduMids Team`
    );

    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error deleting account:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 📨 Forgot Password - Send Reset Link
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email)
    return res.status(400).json({ message: "Email is required" });

  try {
    const user = await User.findOne({ email });
    if (!user) {
      // Respond with success even if user not found (to prevent email enumeration)
      return res.json({ message: "If an account exists with that email, you will receive a password reset link shortly." });
    }

    // Generate a reset token and expiry (1 hour)
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour

    await user.save();

    // Construct reset link (adjust frontend URL as needed)
    const resetUrl = `${process.env.FRONTEND_URL || "https://eduminds-production-180d.up.railway.app"}/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
// http://localhost:5173
    // Send email
    await sendEmail(
      user.email,
      "EduMinds Password Reset",
      `Hi ${user.name},\n\nYou requested a password reset. Click the link below to reset your password:\n\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nEduMids Team`
    );

    res.json({ message: "If an account exists with that email, you will receive a password reset link shortly." });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 🛡 Get current user role/info (for frontend role checks)
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("role name email");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ role: user.role, name: user.name, email: user.email });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Example: Protected Admin Route
router.get("/admin/dashboard", verifyToken, checkRole(["admin"]), (req, res) => {
  res.json({ message: "Welcome to the admin dashboard" });
});

// Example: Protected Teacher Route
router.post("/teacher/create-course", verifyToken, checkRole(["teacher"]), (req, res) => {
  res.json({ message: "Course created successfully" });
});

module.exports = router;

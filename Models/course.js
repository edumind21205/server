const mongoose = require("mongoose");

const CourseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true }, // changed back to string
  price: { type: Number, required: true }, 
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  picture: { type: String, default: "" },
  lessons: [
    { type: mongoose.Schema.Types.ObjectId, ref: "Lesson" },
  ],
  quizzes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Quiz" }],
  createdAt: { type: Date, default: Date.now },
});

const CourseProgressSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  completedLessons: [{ type: mongoose.Schema.Types.ObjectId, ref: "Lesson" }],
}, { timestamps: true });

module.exports = {
  Course: mongoose.model("Course", CourseSchema),
  CourseProgress: mongoose.model("CourseProgress", CourseProgressSchema),
};

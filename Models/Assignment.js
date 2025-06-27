// models/Assignment.js
const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
  deadline: {
    type: Date,
    required: true,
  },
  totalMarks: {
    type: Number,
    default: 100,
  },
  attachmentUrl: {
    type: String, // Cloudinary URL or file path
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // typically a teacher
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model("Assignment", assignmentSchema);

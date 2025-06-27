// models/Submission.js
const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema({
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Assignment",
    required: true,
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // student role
    required: true,
  },
  submittedFileUrl: {
    type: String, // Cloudinary URL
    required: true,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  marksObtained: {
    type: Number,
  },
  feedback: {
    type: String,
  },
}, { timestamps: true });

module.exports = mongoose.model("Submission", submissionSchema);

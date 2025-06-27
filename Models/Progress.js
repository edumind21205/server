const mongoose = require("mongoose");

const progressSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  completedLessons: [{ type: mongoose.Schema.Types.ObjectId, ref: "Lesson" }],
  progressPercentage: { type: Number, default: 0 }
},{ timestamps: true });

module.exports = mongoose.model("Progress", progressSchema);

const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema({
  answeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const questionSchema = new mongoose.Schema({
  askedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  lesson: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson" }, // optional
  text: { type: String, required: true },
  answers: [answerSchema],
  status: { type: String, enum: ["open", "answered", "closed"], default: "open" },
  createdAt: { type: Date, default: Date.now },
  deleted: { type: Boolean, default: false }, // soft delete
});

module.exports = mongoose.model("Question", questionSchema);

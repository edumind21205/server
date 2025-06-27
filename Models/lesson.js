const mongoose = require("mongoose");

const lessonSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  title: { type: String, required: true },
  contentType: { type: String, enum: ["video", "pdf", "quiz", "link"], required: true },
  contentType: { type: String, enum: ["video", "pdf", "quiz", "link"], required: true },
  contentURL: { type: String, required: true },
  // duration: { 
  //   type: Number, 
  //   required: function() { return this.contentType === "video"; },
  //   // duration in seconds (or minutes, clarify in your docs/UI)
  // },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Lesson || mongoose.model("Lesson", lessonSchema);

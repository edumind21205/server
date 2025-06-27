const mongoose = require("mongoose");

const downloadHistorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false }, // null for guests
  fileName: { type: String, required: true },
  filePath: { type: String, required: true },
  courseTitle: { type: String }, // Added course title for display
  downloadedAt: { type: Date, default: Date.now },
  ip: { type: String },
  userAgent: { type: String },
});

module.exports = mongoose.model("DownloadHistory", downloadHistorySchema);

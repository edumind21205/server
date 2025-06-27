// const mongoose = require("mongoose");

// const CourseSchema = new mongoose.Schema({
//   title: {
//     type: String,
//     required: true,
//   },
//   description: {
//     type: String,
//     required: true,
//   },
//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "User",
//     required: true,
//   },
//   lessons: [
//     {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Lesson", // Reference to the Lesson model
//     },
//   ],
//   createdAt: {
//     type: Date,
//     default: Date.now,
//   },
// });

// module.exports = mongoose.model("Courseup", CourseSchema);

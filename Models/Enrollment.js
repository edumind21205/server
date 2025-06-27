const mongoose = require("mongoose");

const EnrollmentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  progress: { type: Number, default: 0 }, 
  certificateIssued: { type: Boolean, default: false }, 
  certificateRevoked: { type: Boolean, default: false }, 
  reissuedCertificates: [
    {
      reissuedAt: { type: Date, default: Date.now }, // ✅ Track each re-issue date
      adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // ✅ Who re-issued it
    }
  ]
}, { timestamps: true }); // <-- Ensure this line is present

module.exports = mongoose.model("Enrollment", EnrollmentSchema);

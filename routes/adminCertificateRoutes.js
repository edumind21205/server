const express = require("express");
const router = express.Router();
const { verifyToken, checkRole } = require("../middleware/authMiddleware");
const Enrollment = require("../Models/Enrollment");
const User = require("../Models/user");
const { Course } = require("../Models/course");
const sendEmail = require("../utils/sendEmail");

// ✅ Get All Issued Certificates (For Admins)
router.get("/issued-certificates", verifyToken, checkRole(["admin"]), async (req, res) => {
  try {
    // Fetch all enrollments where progress is 100% (Course completed)
    const enrollments = await Enrollment.find({ progress: 100 })
      .populate("student", "name email")
      .populate("course", "title");

    // Defensive: handle missing student or course
    const issuedCertificates = enrollments.map((enrollment) => ({
      enrollmentId: enrollment._id,
      studentName: enrollment.student?.name || "Unknown Student",
      studentEmail: enrollment.student?.email || "-",
      courseTitle: enrollment.course?.title || "Unknown Course",
      dateCompleted: enrollment.updatedAt,
    }));

    res.status(200).json({ issuedCertificates });
  } catch (error) {
    console.error("Error in /issued-certificates:", error);
    res.status(500).json({ message: "Server Error", error });
  }
});


// ✅ Revoke a Certificate & Send Email
router.delete("/revoke-certificate/:enrollmentId", verifyToken, checkRole(["admin"]), async (req, res) => {
    try {
      const { enrollmentId } = req.params;
  
      // Find enrollment record
      const enrollment = await Enrollment.findById(enrollmentId).populate("student", "email name");
      if (!enrollment) {
        return res.status(404).json({ message: "Enrollment not found" });
      }
  
      // Mark certificate as revoked
      enrollment.certificateRevoked = true;
      enrollment.certificateIssued = false;
      enrollment.progress = 0; // Reset progress
      await enrollment.save();
  
      // Send email notification
      const emailSubject = "Certificate Revoked - EduMinds";
      const emailText = `Dear ${enrollment.student.name},\n\nYour certificate for the course "${enrollment.course.title}" has been revoked. Please contact support for details.\n\nRegards,\nEduMids Team`;
  
      await sendEmail(enrollment.student.email, emailSubject, emailText);
  
      res.status(200).json({ message: "Certificate revoked successfully and tracked." });
  
    } catch (error) {
      res.status(500).json({ message: "Server Error", error });
    }
  });

  // ✅ Get All Revoked Certificates
router.get("/revoked-certificates", verifyToken, checkRole(["admin"]), async (req, res) => {
    try {
      const revokedCertificates = await Enrollment.find({ certificateRevoked: true })
        .populate("student", "name email")
        .populate("course", "title");
  
      res.status(200).json(revokedCertificates);
    } catch (error) {
      res.status(500).json({ message: "Server Error", error });
    }
  });
  
  // ✅ Reissue a Revoked Certificate (Admin Only)
  router.post("/reissue-certificate/:enrollmentId", verifyToken, checkRole(["admin"]), async (req, res) => {
    try {
      const { enrollmentId } = req.params;
      const adminId = req.user.id; // Get the admin who reissued the certificate

      // Find the enrollment record
      const enrollment = await Enrollment.findById(enrollmentId).populate("student", "email name").populate("course", "title");
      if (!enrollment) {
        return res.status(404).json({ message: "Enrollment not found" });
      }

      // Check if the certificate was revoked
      if (!enrollment.certificateRevoked) {
        return res.status(400).json({ message: "Certificate was not revoked, cannot re-issue." });
      }

      // Re-Issue the Certificate
      enrollment.certificateRevoked = false;
      enrollment.certificateIssued = true;
      if (!enrollment.reissuedCertificates) enrollment.reissuedCertificates = [];
      enrollment.reissuedCertificates.push({ reissuedAt: new Date(), adminId }); // ✅ Log history
      await enrollment.save();

      // Send email notification
      const emailSubject = "Certificate Re-Issued - EduMinds";
      const emailText = `Dear ${enrollment.student.name},\n\nYour certificate for the course \"${enrollment.course.title}\" has been successfully re-issued. You can now download it from your dashboard.\n\nBest Regards,\nEduMids Team`;

      await sendEmail(enrollment.student.email, emailSubject, emailText);

      res.status(200).json({ message: "Certificate re-issued successfully.", reissueHistory: enrollment.reissuedCertificates });
    } catch (error) {
      res.status(500).json({ message: "Server Error", error });
    }
  });
  //
  router.get("/certificate-reissue-history/:enrollmentId", verifyToken, checkRole(["admin"]), async (req, res) => {
    try {
      const { enrollmentId } = req.params;
  
      const enrollment = await Enrollment.findById(enrollmentId)
        .populate("reissuedCertificates.adminId", "name email") // ✅ Populate admin details
        .populate("student", "name email");
  
      if (!enrollment) {
        return res.status(404).json({ message: "Enrollment not found" });
      }
  
      res.status(200).json({ 
        student: enrollment.student,
        course: enrollment.course,
        history: enrollment.reissuedCertificates 
      });
  
    } catch (error) {
      res.status(500).json({ message: "Server Error", error });
    }
  });
  
  // ✅ Get All Revoked & Reissued Certificates (For Admins)
router.get("/revoked-reissued-certificates", verifyToken, checkRole(["admin"]), async (req, res) => {
  try {
    // Find all enrollments that were revoked and then reissued at least once
    const revokedReissued = await Enrollment.find({
      certificateRevoked: false, // currently not revoked
      certificateIssued: true,   // currently issued
      reissuedCertificates: { $exists: true, $not: { $size: 0 } }
    })
      .populate("student", "name email")
      .populate("course", "title")
      .lean();

    // Add last reissue date and admin info for display
    const result = revokedReissued.map(enrollment => {
      const lastReissue = enrollment.reissuedCertificates && enrollment.reissuedCertificates.length > 0
        ? enrollment.reissuedCertificates[enrollment.reissuedCertificates.length - 1]
        : null;
      return {
        _id: enrollment._id,
        student: enrollment.student,
        course: enrollment.course,
        lastReissuedAt: lastReissue ? lastReissue.reissuedAt : null,
        lastReissuedBy: lastReissue ? lastReissue.adminId : null,
        reissueHistory: enrollment.reissuedCertificates || [],
        updatedAt: enrollment.updatedAt,
      };
    });
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});
  
module.exports = router;

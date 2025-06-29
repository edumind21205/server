const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const fs = require("fs");
const Enrollment = require("../Models/Enrollment");
const { Course } = require("../Models/course");
const { issueCertificateValidation } = require("../validators/certificateValidator");
const { validationResult } = require("express-validator");
const notifyUser = require("../utils/notifyUser");
const sendEmail = require("../utils/sendEmail"); // Make sure this path is correct
const cloudinary = require("../utils/cloudinary");
const os = require("os");
const path = require("path");

// ✅ Issue Certificate for Completed Course (Teacher can issue to any student)
router.post("/issue", auth, issueCertificateValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { courseId, studentId } = req.body;

    // Only allow teachers to issue certificates for their own courses
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    // Optionally, check if req.user is a teacher and is the creator of the course
    if (req.user.role !== "teacher" || course.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Check if the student has completed the course
    const enrollment = await Enrollment.findOne({ student: studentId, course: courseId });
    if (!enrollment || enrollment.progress < 100) {
      return res.status(400).json({ message: "Course not completed yet" });
    }

    // Mark certificate as issued
    enrollment.certificateIssued = true;
    await enrollment.save();

    // Notify the student
    await notifyUser(studentId, `🎉 Your certificate for the course "${course.title}" is now available.`);

    // Send email to the student
    const User = require("../Models/user");
    const student = await User.findById(studentId);
    if (student && student.email) {
      await sendEmail({
        to: student.email,
        subject: `Certificate Issued for "${course.title}"`,
        text: `Congratulations ${student.name || "Student"}!\n\nYour certificate for the course "${course.title}" is now available in your EduMinds account.\n\nBest regards,\nEduMids Team`
      });
    }

    res.status(200).json({ message: "Certificate issued successfully!" });
  } catch (error) {
    console.error("Error issuing certificate:", error.message);
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Generate and Download Certificate
router.get("/certificate/:courseId", auth, async (req, res) => {
  try {
    const { courseId } = req.params;

    // Check if user has completed the course
    const enrollment = await Enrollment.findOne({ student: req.user.id, course: courseId });
    if (!enrollment || enrollment.progress < 100) {
      return res.status(400).json({ message: "Course not completed yet" });
    }

    const course = await Course.findById(courseId).populate("createdBy");

    // Get the student's name from the user model
    const User = require("../Models/user");
    const student = await User.findById(req.user.id);
    const studentName = student ? student.name : req.user.name || "Student";
    const dateEarned = enrollment.updatedAt ? new Date(enrollment.updatedAt) : new Date();
    const certificateId = enrollment._id.toString();
    const organization = course.organization || "EduMinds";
    const courseTitle = course.title;
    const courseDesc = course.description;
    const instructorName = course.createdBy && course.createdBy.name ? course.createdBy.name : "Instructor";

    // Generate PDF Certificate and save to temp file
    const PDFDocument = require("pdfkit");
    const fs = require("fs");
    const tmpFilePath = path.join(os.tmpdir(), `Certificate-${studentName}-${courseTitle}-${Date.now()}.pdf`);
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const writeStream = fs.createWriteStream(tmpFilePath);
    doc.pipe(writeStream);

    // Professional border
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke('#1e3a8a');

    // Organization logo (inserted at the top right)
    try {
      const logoPath = path.join(__dirname, '../../frontend/public/assets/logo.png');
      if (fs.existsSync(logoPath)) {
        // Place logo at top right, inside border, with some margin
        doc.image(logoPath, doc.page.width - 120, 30, { width: 80 });
      }
    } catch (e) {
      // If logo not found, skip image
    }

    doc.moveDown(2.5); // Adjust spacing after logo
    doc.fontSize(28).fillColor('#1e3a8a').text(organization, { align: "center", underline: true });
    doc.moveDown(1);
    doc.fontSize(24).fillColor('black').text("Certificate of Completion", { align: "center" });
    doc.moveDown(2);
    doc.fontSize(16).text(`Certificate ID: ${certificateId}`, { align: "right" });
    doc.moveDown(2);
    doc.fontSize(18).text(`This is to certify that`, { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(22).fillColor('#2563eb').text(studentName, { align: "center", underline: true });
    doc.moveDown(1);
    doc.fontSize(18).fillColor('black').text(`has successfully completed the course`, { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(20).fillColor('#1e3a8a').text(`"${courseTitle}"`, { align: "center", underline: true });
    doc.moveDown(1);
    doc.fontSize(14).fillColor('black').text(courseDesc, { align: "center", width: 400 });
    doc.moveDown(2);
    doc.fontSize(16).text(`Date Earned: ${dateEarned.toLocaleDateString()}`, { align: "left" });
    doc.fontSize(16).text(`Instructor: ${instructorName}`, { align: "right" });
    doc.moveDown(4);
    doc.fontSize(12).fillColor('gray').text("This certificate is awarded by " + organization + " for the successful completion of the above course.", { align: "center" });
    doc.moveDown(2);
    doc.fontSize(12).fillColor('gray').text("Generated by EduMinds Platform", { align: "center" });
    // Signature line
    doc.moveDown(2);
    doc.fontSize(14).fillColor('black').text("__________", { align: "right" });
    doc.fontSize(12).fillColor('black').text("Instructor Signature", { align: "right" });
    doc.end();

    writeStream.on("finish", async () => {
      try {
        // Send the PDF file as a download
        res.download(tmpFilePath, `Certificate-${studentName}-${courseTitle}.pdf`, (err) => {
          // Delete temp file after sending
          if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
          if (err) {
            return res.status(500).json({ message: "File download failed", error: err });
          }
        });
      } catch (err) {
        if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
        return res.status(500).json({ message: "Certificate file handling failed", error: err });
      }
    });
    writeStream.on("error", (err) => {
      return res.status(500).json({ message: "PDF generation failed", error: err });
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Get All Certificates for Logged-in Student
router.get("/my-certificates", auth, async (req, res) => {
  try {
    // Find all enrollments where the user is the student and certificateIssued is true
    const enrollments = await Enrollment.find({
      student: req.user.id,
      certificateIssued: true
    }).populate("course");

    // Map to certificate details
    const certificates = enrollments.map(enrollment => ({
      certificateId: enrollment._id,
      courseName: enrollment.course?.title || "Unknown Course",
      organization: enrollment.course?.organization || "EduMinds",
      dateEarned: enrollment.certificateIssued && enrollment.updatedAt ? enrollment.updatedAt : enrollment.createdAt,
      courseId: enrollment.course?._id
    }));

    res.status(200).json({ certificates });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ Get a single certificate by certificateId (enrollment _id)
// router.get("/my-certificate/:certificateId", auth, async (req, res) => {
//   try {
//     const { certificateId } = req.params;
//     const enrollment = await Enrollment.findOne({
//       _id: certificateId,
//       student: req.user.id,
//       certificateIssued: true
//     }).populate("course");

//     if (!enrollment) {
//       return res.status(404).json({ message: "Certificate not found" });
//     }

//     const certificate = {
//       certificateId: enrollment._id,
//       courseName: enrollment.course?.title || "Unknown Course",
//       organization: enrollment.course?.organization || "EduMinds",
//       dateEarned: enrollment.certificateIssued && enrollment.updatedAt ? enrollment.updatedAt : enrollment.createdAt,
//       courseId: enrollment.course?._id
//     };

//     res.status(200).json({ certificate });
//   } catch (error) {
//     res.status(500).json({ message: "Server Error", error });
//   }
// });

module.exports = router;

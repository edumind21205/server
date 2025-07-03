const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const swaggerSetup = require('./config/swaggerSetup');

// Import Routes
const authRoutes = require("./routes/authRoutes");
const courseRoutes = require("./routes/courseRoutes");
const enrollmentRoutes = require("./routes/enrollmentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const TeacherRoutes = require("./routes/TeacherRoutes");
const StudentRoutes = require("./routes/Studentroutes"); // Fix import casing
const lessonRoutes = require("./routes/lessonRoutes");
const quizRoutes = require("./routes/quizRoutes");
const adminCertificateRoutes = require("./routes/adminCertificateRoutes");
const adminDashboardRoutes = require("./routes/adminDashboardRoutes");
const TeacherDashboardRoutes = require("./routes/TeacherDashboardroutes");
const studentDashboardRoutes = require("./routes/studentDashboardRoutes");
const paymentRoutes = require("./routes/paymentRouters");
const errorHandler = require("./middleware/errorHandler");
const progressRoutes = require("./routes/progressRoutes");
const path = require("path");
const notificationRoutes = require("./routes/notificationRoutes");
const certificateRoutes = require("./routes/certificateRoutes"); // Add this line
const QnaRoutes = require("./routes/qnas"); // Import Q&A routes
const contactRoutes = require("./routes/contactRoutes"); // Import contact routes
const impactRoutes = require("./routes/impact"); // Import impact routes
const downloadRoutes = require("./routes/download"); // Import download routes
const assignmentRoutes = require("./routes/assignmentRoutes"); // Import assignment routes
const submissionRoutes = require("./routes/submissionRoutes"); // Import submission routes
const searchRoutes = require("./routes/searchRoutes"); // Import search routes

dotenv.config(); // Load environment variables

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: true,             // Allows all origins when combined with credentials
  credentials: true         // Allows cookies, authorization headers, etc.
}));

// Swagger Docs
swaggerSetup(app);

// Connect to MongoDB
connectDB();

// Serve uploads folder statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve video files with correct headers and range support
app.get('/video/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'uploads', req.params.filename);
  const fs = require('fs');
  fs.stat(filePath, (err, stats) => {
    if (err) return res.status(404).end('Video not found');
    let range = req.headers.range;
    if (!range) {
      res.writeHead(200, {
        'Content-Length': stats.size,
        'Content-Type': 'video/mp4',
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunkSize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4',
      });
      file.pipe(res);
    }
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/teacher", TeacherRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/progress", progressRoutes); 
app.use("/api/certificates", certificateRoutes); 
app.use("/api/admin/dashboard", adminDashboardRoutes);
app.use("/api/teacher/dashboard", TeacherDashboardRoutes);
app.use("/api/student/dashboard", studentDashboardRoutes);
app.use("/api/student", StudentRoutes); 
app.use("/api/admin/certificates", adminCertificateRoutes);
app.use("/api/payment", paymentRoutes);
app.use(errorHandler);
app.use("/api/notifications", notificationRoutes);
app.use("/api/qna", QnaRoutes); // Use Q&A routes
app.use("/api/contact", contactRoutes); // Use contact routes
app.use("/api/impact", impactRoutes); // Use impact routes at correct path
app.use("/api/download", downloadRoutes); // Use download routes
app.use("/api/assignments", assignmentRoutes); // Use assignment routes
app.use("/api/submissions", submissionRoutes); // Use submission routes
app.use("/api/search", searchRoutes); // Use search routes


// In your main server file (index.js or server.js)



// Default Route
app.get("/", (req, res) => {
  res.send("🎉 EduMinds API is running...");
});

// Start the Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
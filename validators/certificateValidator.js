const { body } = require("express-validator");

exports.issueCertificateValidation = [
  // body("userId").notEmpty().withMessage("User ID is required"),
  body("courseId").notEmpty().withMessage("Course ID is required"),
];

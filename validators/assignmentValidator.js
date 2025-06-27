const { body } = require("express-validator");

exports.assignmentValidation = [
  body("title")
    .notEmpty().withMessage("Assignment title is required"),
  body("course")
    .notEmpty().withMessage("Course is required"),
  body("deadline")
    .notEmpty().withMessage("Deadline is required")
    .isISO8601().withMessage("Deadline must be a valid date"),
  body("totalMarks")
    .notEmpty().withMessage("Total marks are required")
    .isNumeric().withMessage("Total marks must be a number"),
  body("description")
    .optional().isString().withMessage("Description must be a string"),
  body("attachmentUrl")
    .optional().isString().withMessage("Attachment URL must be a string"),
];

const { body } = require("express-validator");

exports.lessonValidation = [
  body("title").notEmpty().withMessage("Lesson title is required"),
  body("contentType").notEmpty().withMessage("Content type is required"),
  body("courseId").notEmpty().withMessage("Associated course ID is required"),
  // contentURL is optional because it may be set by multer if a file is uploaded
  body("contentURL").optional(),
];

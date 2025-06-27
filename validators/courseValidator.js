const { body } = require("express-validator");

exports.createCourseValidation = [
  body("title").notEmpty().withMessage("Course title is required"),
  body("description").notEmpty().withMessage("Description is required"),
  // body("price").isFloat({ min: 0 }).withMessage("Price must be a positive number"),
];

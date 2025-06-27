const { body } = require("express-validator");

exports.quizValidation = [
  body("course").notEmpty().withMessage("Associated course ID is required"),
  body("title").notEmpty().withMessage("Quiz title is required"),
  body("questions")
    .isArray({ min: 1 })
    .withMessage("Questions must be an array with at least one question")
    .custom((questions) => {
      for (const question of questions) {
        if (!question.questionText) throw new Error("Each question must have a questionText");
        if (!question.options || question.options.length < 2)
          throw new Error("Each question must have at least two options");
        if (!question.correctAnswer) throw new Error("Each question must have a correctAnswer");
      }
      return true;
    }),
];

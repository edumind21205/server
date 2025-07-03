// Swagger configuration for your API documentation
const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EduMids API',
      version: '1.0.0',
      description: 'API documentation for EduMids backend',
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Local server',
      },
    ],
  },
  apis: ['./routes/*.js'], // Path to the API docs
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;

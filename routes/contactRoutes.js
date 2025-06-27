const express = require('express');
const router = express.Router();
const sendEmail = require('../utils/sendEmail');

// POST /api/contact
router.post('/', async (req, res) => {
  const { firstName, lastName, email, subject, message } = req.body;
  if (!firstName || !lastName || !email || !subject || !message) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  try {
    const mailSubject = `[Contact Form] ${subject}`;
    const mailText = `Name: ${firstName} ${lastName}\nEmail: ${email}\n\nMessage:\n${message}`;
    await sendEmail(
      process.env.CONTACT_EMAIL || 'edumindeduinfo@gmail.com',
      mailSubject,
      mailText
    );
    res.status(200).json({ message: 'Message sent successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

module.exports = router;

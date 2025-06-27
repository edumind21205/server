const mongoose = require("mongoose");

const CertificateSchema = new mongoose.Schema({
  // ...your fields...
  // e.g. courseId, userId, organization, etc.
  dateEarned: { type: Date }, // optional, but recommended
  // ...other fields...
}, { timestamps: true }); // <-- ensure this is present

module.exports = mongoose.model("Certificate", CertificateSchema);
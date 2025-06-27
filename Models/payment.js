const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  amount: { type: Number, required: true },
  paymentDate: { type: Date, default: Date.now },
  stripePaymentId: { type: String }, // Optional: store Stripe payment/session id
});

module.exports = mongoose.model("Payment", PaymentSchema);

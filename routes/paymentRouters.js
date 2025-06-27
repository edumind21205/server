const express = require("express");
const Stripe = require("stripe");
require("dotenv").config();
const { verifyToken, checkRole } = require("../middleware/authMiddleware");
const notifyUser = require("../utils/notifyUser");
const auth = require("../middleware/auth"); // Import the auth middleware
const Payment = require("../Models/payment");
const { Course } = require("../Models/course");
const User = require("../Models/user");

const router = express.Router();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ Create a payment session for a course
router.post("/create-checkout-session", auth, async (req, res) => {
  const { courseName, price } = req.body;

  try {
    // Validate input
    if (!courseName || !price) {
      return res.status(400).json({ message: "Course name and price are required" });
    }

    // Create a Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "pkr", // Use "pkr" for Pakistani Rupee
            product_data: {
              name: courseName,
            },
            unit_amount: price * 100, // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: "http://localhost:3000/payment-success",
      cancel_url: "http://localhost:3000/payment-cancel",
    });

    // Notify the user about the successful payment
    await notifyUser(req.user.id, `💳 Payment successful! You've purchased the course "${courseName}". Start learning now!`);

    res.status(200).json({ id: session.id });
  } catch (error) {
    console.error("Error creating payment session:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Create a PaymentIntent for Stripe Elements (used by frontend Checkout.jsx)
router.post("/create-payment-intent", auth, async (req, res) => {
  const { courseId } = req.body;
  try {
    // You may want to fetch course details from DB for price, but for now, let's assume price is sent or hardcoded
    // Example: Fetch course from DB (pseudo-code):
    // const course = await Course.findById(courseId);
    // if (!course) return res.status(404).json({ message: "Course not found" });
    // const price = course.price;
    // For demo, get price from body (frontend sends it)
    const price = req.body.price;
    if (!courseId || !price) {
      return res.status(400).json({ message: "Course ID and price are required" });
    }
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(price * 100), // cents
      currency: "pkr", // Use "pkr" for Pakistani Rupee
      description: `Payment for course ID: ${courseId}`,
      metadata: { courseId: String(courseId), userId: String(req.user.id) },
      // Optionally, you can add receipt_email: req.user.email
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Error creating payment intent:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Save payment after successful Stripe payment
router.post("/save-payment", auth, async (req, res) => {
  try {
    const { courseId, amount, stripePaymentId } = req.body;
    if (!courseId || !amount) {
      return res.status(400).json({ message: "Course ID and amount are required" });
    }
    const payment = new Payment({
      student: req.user.id,
      course: courseId,
      amount,
      paymentDate: new Date(),
      stripePaymentId: stripePaymentId || undefined,
    });
    await payment.save();
    res.status(201).json({ message: "Payment saved", payment });
  } catch (error) {
    res.status(500).json({ message: "Error saving payment", error: error.message });
  }
});

// GET: Admin payment history (all payments with student and course details)
// router.get("/admin-history", auth, async (req, res) => {
//   try {
//     if (!req.user || req.user.role !== "admin") {
//       return res.status(403).json({ message: "Access denied. Admins only." });
//     }
//     // Populate student and course details
//     const payments = await Payment.find()
//       .populate("student", "name email")
//       .populate("course", "title description price category");
//     res.status(200).json(payments);
//   } catch (error) {
//     console.error("Error fetching payment history:", error.message);
//     res.status(500).json({ error: error.message });
//   }
// });

module.exports = router;

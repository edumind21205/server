const jwt = require("jsonwebtoken");
const User = require("../Models/user");

// Middleware to verify user token
const verifyToken = async (req, res, next) => {
  const authHeader = req.header("Authorization");
  console.log("Authorization header:", authHeader);
  if (!authHeader) return res.status(401).json({ message: "Access Denied" });

  const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    // Always use 'id' for consistency
    const user = await User.findById(verified.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    req.user = { id: user._id.toString(), role: user.role }; // Always use _id as string
    next();
  } catch (err) {
    res.status(400).json({ message: "Invalid Token" });
  }
};

const checkRole = (roles) => (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(403).json({ message: "Access Forbidden" });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Access Forbidden" });
  }
  next();
};

module.exports = { verifyToken, checkRole };

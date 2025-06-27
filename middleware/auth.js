const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authHeader = req.header("Authorization");
  if (!authHeader) return res.status(401).json({ message: "No token, authorization denied" });
  const token = authHeader.replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // decoded should have id and role
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

const Notification = require("../Models/notification");

const notifyUser = async (userId, message) => {
  try {
    await Notification.create({
      user: userId,
      message,
      isRead: false,
    });
  } catch (err) {
    console.error("Notification error:", err);
  }
};

module.exports = notifyUser;

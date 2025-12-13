// This is used to clear notification if they are 7 days old or agr 50 se jyada h to 

const AdminNotification = require("./models/AdminNotificationSchema");

(async () => {
  try {
    const admin = await AdminNotification.findOne();
    if (!admin) return; // Agar admin document hi nahi, kuch nahi karna

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // 7 din se purani notifications delete
    admin.notifications = admin.notifications.filter(
      n => n.createdAt >= oneWeekAgo
    );

    // 2️⃣ Sirf latest 50 notifications rakho
    if (admin.notifications.length > 50) {
      admin.notifications = admin.notifications.slice(0, 50);
    }

    await admin.save();
    console.log("✅ Admin notifications cleanup done.");
  } catch (err) {
    console.error("⚠️ Error during admin notifications cleanup:", err);
  }
})();

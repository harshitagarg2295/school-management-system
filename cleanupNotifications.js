// This is used to clear notification if they are 7 days old or agr 50 se jyada h to 
const cron = require('node-cron');
const AdminNotification = require("./models/AdminNotificationSchema");

// '0 0 * * *' ka matlab hai raat ke 12 baje or agr 12: 20 krna h to '20 0 * * *'
cron.schedule('0 0 * * *', async () => {
  try {
    console.log("⏰ Running Scheduled Cleanup: Cleaning old notifications...");

    const admins = await AdminNotification.find();
    if (!admins || admins.length === 0) return;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    for (let adm of admins) {
      const originalCount = adm.notifications.length;

      // 1. Filter: 7 din se purani hatao
      adm.notifications = adm.notifications.filter(
        n => n.createdAt >= oneWeekAgo
      );

      // 2. Limit: Agar 50 se zyada hain, toh latest 50 rakho
      // Note: Kyunki hum unshift use karte hain, slice(0, 50) newest items hi rakhega
      if (adm.notifications.length > 50) {
        adm.notifications = adm.notifications.slice(0, 50);
      }

      // Sirf tab save karo agar kuch delete hua ho (Performance optimization)
      if (adm.notifications.length !== originalCount) {
        await adm.save();
        console.log(`✅ Cleanup done for school: ${adm.schoolCode}`);
      }
    }
  } catch (err) {
    console.error("⚠️ Error during admin notifications cleanup:", err);
  }
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"  // 🔥 Ye line India ka time set kar degi
});
const express = require('express')
const router = express.Router()
const Events = require("../../models/Events")
const { adminAuth } =  require("../../middlewares/auth");


// For Add Event 
router.post("/add-event", async (req, res) => {
    const { title, description, date, time } = req.body;
    await Events.create({ title, description, date, time });
    res.json({ success: true, message: "Event saved successfully!" });
})

router.get("/calen-menu", async (req, res) => {
  const allEvents = await Events.find();

  const role = req.query.role || "student"; // default role
  res.render("eventCalendar", { events: allEvents, role });
});

module.exports = router
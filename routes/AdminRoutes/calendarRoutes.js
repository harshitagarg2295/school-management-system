const express = require('express')
const router = express.Router()
const Events = require("../../models/Events")
const { adminAuth } = require("../../middlewares/auth");


// For Add Event 
router.post("/add-event", adminAuth, async (req, res) => {
  const { title, description, date, time } = req.body;
  await Events.create({ title, description, date, time });
  res.json({ success: true, message: "Event saved successfully!" });
})

// Delete event
router.delete("/delete-event/:id", adminAuth, async (req, res) => {
  await Events.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// Update event
router.put("/update-event/:id", adminAuth, async (req, res) => {
  const { title, description, time, date } = req.body;

  await Events.findByIdAndUpdate(req.params.id, {
    title,
    description,
    time,
    date
  });

  res.json({ success: true });
});



router.get("/calen-menu", async (req, res) => {
  const allEvents = await Events.find();

  const role = req.query.role || "student"; // default role
  res.render("Admin/eventCalendar", { events: allEvents, role });
});

module.exports = router
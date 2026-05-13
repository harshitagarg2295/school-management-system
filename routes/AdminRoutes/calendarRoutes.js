const express = require('express')
const router = express.Router()
const Events = require("../../models/Events")
const { adminAuth, anyAuth } = require("../../middlewares/auth");


// For Add Event 
router.post("/add-event", adminAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  const { title, description, date, time } = req.body;
  await Events.create({ title, description, date, time, schoolCode });
  res.json({ success: true, message: "Event saved successfully!" });
})

// Delete event
router.delete("/delete-event/:id", adminAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  await Events.findOneAndDelete({
    _id: req.params.id,
    schoolCode
  });
  res.json({ success: true });
});

// Update event
router.put("/update-event/:id", adminAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;
  const { title, description, time, date } = req.body;

  await Events.findOneAndUpdate(
    { _id: req.params.id, schoolCode }, // 🔥 filter
    {
      title,
      description,
      time,
      date
    }
  );

  res.json({ success: true });
});


router.get("/calen-menu", anyAuth, async (req, res) => {
  const schoolCode = req.session.schoolCode;

  const allEvents = await Events.find({ schoolCode });

  const role = req.session.userRole;
  
  res.render("Admin/eventCalendar", {
    events: allEvents,
    role
  });
});

module.exports = router
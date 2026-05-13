const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
require("dotenv").config();

const SuperAdmin = require("./models/SuperAdmin");

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("DB Connected"))
  .catch(err => console.log(err));

//   This file is used to create super admin with desire username & password 
// we just run it only once not every time we use the project

async function createAdmin() {
  try {
    const existing = await SuperAdmin.findOne({ username: "harshitagarg" });

    if (existing) {
      console.log("Admin already exists");
      return process.exit();
    }

    const hashedPassword = await bcrypt.hash("Garg2295@", 10);

    await SuperAdmin.create({
      username: "harshitagarg",
      password: hashedPassword
    });

    console.log("Super Admin Created ✅");
    process.exit();

  } catch (err) {
    console.log(err);
    process.exit();
  }
}

createAdmin();
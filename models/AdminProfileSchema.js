const mongoose = require('mongoose')

const profileSchema = new mongoose.Schema({

    name: String,
    email: String,
    mobile: Number,
    address: String,
    bio: { type: String, required: false },
    username: String,
    password: String,
    image: String,

})

module.exports = mongoose.model("adminProfileSchem", profileSchema);
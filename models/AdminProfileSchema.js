const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
    schoolCode: {
        type: String,
        required: true
    },
    name: String,
    email: String,
    mobile: Number,
    address: String,
    city: {
        type: String,
        default: ""
    },
    state: {
        type: String,
        default: ""
    },
    pincode: {
        type: String,
        default: ""
    },
    bio: { type: String, required: false },
    username: String,
    password: String,
    image: String,

    // Razorpay Integration Fields
    schoolAccountId: {
        type: String,
        default: ""
    },
    bankSetupStatus: {
        type: String,
        enum: ["Pending", "Completed"],
        default: "Pending"
    },
    businessType: {
        type: String,
        default: ""
    },
    legalName: {
        type: String,
        default: ""
    },
    panNumber: {
        type: String,
        default: ""
    },
    accountNumberMasked: {
        type: String,
        default: ""
    },
    ifscCode: {
        type: String,
        default: ""
    }
});

module.exports = mongoose.model("adminProfileSchema", profileSchema);
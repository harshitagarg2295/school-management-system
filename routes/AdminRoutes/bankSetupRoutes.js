const express = require("express");
const router = express.Router();

const Razorpay = require("razorpay");

const AdminProfile = require("../../models/AdminProfileSchema");

const { adminAuth } = require("../../middlewares/auth");

function getRazorpayInstance(mode) {

    return new Razorpay({
        key_id: mode === "live" ? process.env.RAZORPAY_LIVE_KEY_ID : process.env.RAZORPAY_TEST_KEY_ID,
        key_secret: mode === "live" ? process.env.RAZORPAY_LIVE_KEY_SECRET : process.env.RAZORPAY_TEST_KEY_SECRET
    });
}

// GET - Bank Setup Page

router.get("/bank-setup", adminAuth, async (req, res) => {

    const schoolCode = req.session.schoolCode;
    const schoolName = req.session.schoolName;

    try {

        const admin = await AdminProfile.findOne({ schoolCode });

        if (!admin) {
            return res.status(404).send("Admin profile not found");
        }

        const safeAdmin = {
            bankSetupStatus: admin.bankSetupStatus || "Pending",
            email: admin.email || admin.username || "",
            legalName: admin.legalName || "",
            accountNumberMasked: admin.accountNumberMasked || "",
            ifscCode: admin.ifscCode || "",
            city: admin.city || "",
            state: admin.state || "",
            schoolAccountId: admin.schoolAccountId || ""
        };

        res.render("Admin/bankSetup", {
            admin: safeAdmin,
            schoolName: schoolName || "Our School"
        });

    }

    catch (err) {

        console.error("Bank setup page load error:", err);
        res.status(500).send("Server Error");
    }
});


// POST - Bank Setup

router.post("/bank-setup", adminAuth, async (req, res) => {

    const schoolCode = req.session.schoolCode;

    const { businessType, legalName, panNumber, schoolEmail, accountNumber, ifscCode, city, state, pincode } = req.body;

    try {

        // Basic validation

        if (!businessType || !legalName || !panNumber || !schoolEmail || !accountNumber || !ifscCode || !city || !state || !pincode
        ) {

            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });
        }

        // Account number masking

        const maskedAccount = "X".repeat(Math.max(0, accountNumber.length - 4)) + accountNumber.slice(-4);

        const existingAdmin = await AdminProfile.findOne({ schoolCode });

        if (!existingAdmin) {
            return res.status(404).json({
                success: false,
                message: "Admin profile not found."
            });
        }

        const razorpay = getRazorpayInstance(existingAdmin?.paymentMode || "test");

        let cleanStreetAddress = existingAdmin?.address?.trim();

        if (!cleanStreetAddress) {

            return res.status(400).json({
                success: false,
                message: "Please first complete school profile address details."
            });
        }
        try {

            const account =
                await razorpay.accounts.create({

                    type: "route",
                    email: schoolEmail,
                    business_type: businessType,
                    legal_business_name: legalName,
                    profile: {

                        category: "educational_services",
                        subcategory: "schools",
                        addresses: {
                            registered: {
                                street1: cleanStreetAddress,
                                city: city,
                                state: state,
                                postal_code: pincode,
                                country: "IN"
                            }
                        }
                    },

                    funding_source: "bank_account",
                    bank_account: {

                        account_number: accountNumber,
                        ifsc_code: ifscCode.toUpperCase(),
                        beneficiary_name: legalName
                    }
                });

            await AdminProfile.findOneAndUpdate(

                { schoolCode },
                {
                    schoolAccountId: account.id,
                    bankSetupStatus: "Completed",
                    businessType: businessType,
                    legalName: legalName,
                    panNumber: panNumber.toUpperCase(),
                    accountNumberMasked: maskedAccount,
                    ifscCode: ifscCode.toUpperCase(),
                    city: city,
                    state: state,
                    pincode: pincode
                }
            );

            return res.json({
                success: true,
                schoolAccountId: account.id
            });
        }

        catch (rzpErr) {

            const errorDesc = (rzpErr.error && rzpErr.error.description) ? rzpErr.error.description : "";

            console.warn(
                "Razorpay account creation error:",
                errorDesc || rzpErr.message
            );

            // Sandbox testing fallback

            if (
                errorDesc.includes("Route feature not enabled") ||
                rzpErr.message.includes("Route feature not enabled") ||
                errorDesc.includes("feature is not enabled")
            ) {
              const dummyAccountId = "acc_TEST" + Math.floor(1000000000 + Math.random() * 9000000000);

                await AdminProfile.findOneAndUpdate(
                    { schoolCode },
                    {
                        schoolAccountId: dummyAccountId,
                        bankSetupStatus: "Completed",
                        businessType: businessType,
                        legalName: legalName,
                        panNumber: panNumber.toUpperCase(),
                        accountNumberMasked: maskedAccount,
                        ifscCode: ifscCode.toUpperCase(),
                        city: city,
                        state: state,
                        pincode: pincode
                    }
                );

                return res.json({

                    success: true,
                    schoolAccountId: dummyAccountId,
                    note: "Sandbox testing mode active."
                });
            }

            throw rzpErr;
        }
    }

    catch (err) {
        console.error("Final bank setup error:", err);
        const rzpMessage = (err.error && err.error.description) ? err.error.description : "Gateway routing registration failed.";

        res.status(400).json({
            success: false,
            message: rzpMessage
        });
    }
});

module.exports = router;
// is file m schools dwara super admin ko kiye kre transaction ki history hogi 

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    schoolId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'School', // Ye tumhare School model se link karega
        required: true 
    },
    schoolName: { 
        type: String, 
        required: true 
    },
    plan: { 
        type: String, 
        enum: ['monthly', 'quarterly', 'half-yearly', 'annually'],
        required: true 
    },
    amount: { 
        type: Number, 
        required: true 
    },
    paymentDate: { 
        type: Date, 
        default: Date.now 
    },
    expiryDateAtThatTime: { 
        type: Date // Optional: Record ke liye ki renewal ke baad nayi expiry kya set hui
    }
});

module.exports = mongoose.model('Transaction', transactionSchema);
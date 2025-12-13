const mongoose = require('mongoose')

const staffSchema = new mongoose.Schema({
    name: String,
    empId: String,
    category: String,
    salary: Number,
    address: String,
    phone: Number,

     salaryStatus: { 
        type: Map, // Key: Year (e.g., "2024")
        of: {
            type: Map, // Key: Month (e.g., "7" or "07")
            of: { 
                type: String, // Value: "paid" or "pending"
                default: 'pending'
            }
        },
        default: {}
    }
})
module.exports = mongoose.model('StaffSchema', staffSchema);

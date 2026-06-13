const express = require('express');
const router = express.Router();
const Expense = require('../../models/Expense');
const AdminNotification = require("../../models/AdminNotificationSchema");
const { adminAuth } = require("../../middlewares/auth");
const { uploadMaterial } = require("../../config/cloudinaryConfig");
const { cloudinary } = require("../../config/cloudinaryConfig");

// helper: current FY start year (Apr–Mar)
function currentFYStartYear(d = new Date()) {
    const m = d.getMonth(); // Jan=0 ... Dec=11
    const y = d.getFullYear();
    return m >= 3 ? y : y - 1; // Apr(3) ya uske baad => same year, warna prev
}

// helper: title case (safety)
function toTitleCase(str = "") {
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
}

router.get("/school_expenses", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;

        // ===== Table/list filters =====
        const search = req.query.search?.toLowerCase() || "";
        const selectedCategory = req.query.categories || "";
        const selectedMonthYear = req.query["month-year"] || "";

        // ===== Charts filters =====
        const selectedYear = parseInt(req.query.year) || currentFYStartYear(); // FY start year
        const pieMonth = (req.query.pieMonth ?? "current-year").toString();    // "current-year" | "0".."11" (FY index)

        const allExpenses = await Expense.find({ schoolCode }).sort({ paymentDate: -1 });

        // ---------- Table rows filtering ----------
        const filteredExpenses = allExpenses.filter(exp => {
            const matchesSearch =
                (exp.title || "").toLowerCase().includes(search) ||
                exp._id.toString().includes(search);

            const matchesCategory =
                !selectedCategory || exp.category.toLowerCase() === selectedCategory.toLowerCase();

            const matchesMonthYear = !selectedMonthYear || (() => {
                const [year, month] = selectedMonthYear.split("-");
                const d = new Date(exp.paymentDate);
                return (
                    d.getFullYear().toString() === year &&
                    (d.getMonth() + 1).toString().padStart(2, '0') === month
                );
            })();

            return matchesSearch && matchesCategory && matchesMonthYear;
        });

        // ---------- availableYears (FY start years present in DB) ----------
        const yearSet = new Set();
        allExpenses.forEach(exp => {
            const d = new Date(exp.paymentDate);
            const fyStart = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
            yearSet.add(fyStart);
        });
        const availableYears = Array.from(yearSet).sort((a, b) => b - a);

        // ---------- Line chart: monthlySpendingAmount for selected FY ----------
        const monthlySpendingAmount = new Array(12).fill(0); // FY index: 0=Apr ... 11=Mar
        const fyStartDate = new Date(selectedYear, 3, 1);                 // Apr 1, selectedYear
        const fyEndDate = new Date(selectedYear + 1, 3, 31, 23, 59, 59);  // Mar 31, next year (end of day)

        allExpenses.forEach(exp => {
            const d = new Date(exp.paymentDate);
            if (d >= fyStartDate && d <= fyEndDate) {
                const jsMonth = d.getMonth();              // 0..11
                const fyIndex = (jsMonth + 9) % 12;        // map: Apr=0 ... Mar=11
                monthlySpendingAmount[fyIndex] += Number(exp.amount) || 0;
            }
        });

        // ---------- Pie chart: category totals for either FY or specific month ----------
        const CATEGORIES = [
            "Management",
            "Infrastructure",
            "Maintenance",
            "Salary Distribution",
            "Sports",
            "Laboratory",
            "Library",
            "Transportation",
            "Arts & Crafts",
            "Other"
        ];
        const categoryTotals = Object.fromEntries(CATEGORIES.map(c => [c, 0]));

        // Select time window for pie:
        let pieStart = fyStartDate, pieEnd = fyEndDate; // default whole FY
        if (pieMonth !== "current-year") {
            const fyIdx = parseInt(pieMonth, 10); // 0..11 (Apr..Mar)
            const jsMonth = (fyIdx + 3) % 12;     // back to Gregorian month
            const yearForThisMonth = jsMonth >= 3 ? selectedYear : selectedYear + 1;
            pieStart = new Date(yearForThisMonth, jsMonth, 1, 0, 0, 0);
            pieEnd = new Date(yearForThisMonth, jsMonth + 1, 0, 23, 59, 59); // end of that month
        }

        allExpenses.forEach(exp => {
            const d = new Date(exp.paymentDate);
            if (d >= pieStart && d <= pieEnd) {
                const key = toTitleCase(exp.category);
                if (categoryTotals[key] != null) {
                    categoryTotals[key] += Number(exp.amount) || 0;
                } else {
                    // unknown category -> bucket in Other
                    categoryTotals["Other"] += Number(exp.amount) || 0;
                }
            }
        });

        const pieCategoryLabels = CATEGORIES;
        const pieCategoryData = CATEGORIES.map(c => categoryTotals[c] || 0);


        const admin = await AdminNotification.findOne({ schoolCode }) || { notifications: [] };

        res.render("Admin/school_expenses", {
            // table
            expenses: filteredExpenses,
            search,
            selectedCategory,
            selectedMonthYear,

            // line chart
            availableYears,
            selectedYear,
            monthlySpendingAmount,

            // pie chart
            pieMonth,
            pieCategoryLabels,
            pieCategoryData,

            admin
        });
    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});


// POST route to add new expense
router.post("/add-expense", adminAuth, uploadMaterial.single("bill"), async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        const { category, title, quantity, amount, paymentDate } = req.body;

        const pyDate = new Date(paymentDate);  // 👈 string to Date object

        const expense = new Expense({
            category: toTitleCase(category),
            title: toTitleCase(title),
            quantity: toTitleCase(quantity),
            amount,
            paymentDate: pyDate,
            schoolCode,
            bill: req.file ? req.file.path : "",
            billPublicId: req.file.filename
        });

        await expense.save();
        res.redirect("/school_expenses");
    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});

// Route for Edit particular expense
router.post("/edit-expense/:id", adminAuth, uploadMaterial.single("bill"), async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;
        const { category, title, quantity, amount, paymentDate } = req.body;

        const pyDate = new Date(paymentDate);  // 👈 string to Date object

        const updateData = {
            category: toTitleCase(category),
            title: toTitleCase(title),
            quantity: toTitleCase(quantity),
            amount,
            paymentDate: pyDate
        };

        if (req.file) {
            updateData.bill = req.file.path;
            updateData.billPublicId = req.file.filename;
        }

        await Expense.findOneAndUpdate(
            {
                _id: req.params.id,
                schoolCode
            },
            updateData
        );
        res.redirect("/school_expenses");
    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});

// Route for delete particular expense
router.post("/delete-expense/:id", adminAuth, async (req, res) => {
    try {
        const schoolCode = req.session.schoolCode;

        const expense = await Expense.findOne({
            _id: req.params.id,
            schoolCode
        });

        if (!expense) {
            return res.redirect("/school_expenses");
        }

        if (expense.bill) {

            await cloudinary.uploader.destroy(
                expense.billPublicId,
                { resource_type: "raw" }
            );
        }

        await Expense.findOneAndDelete({
            _id: req.params.id,
            schoolCode
        });

        res.redirect("/school_expenses");

    } catch (err) {
        console.error(err);
        return res.status(500).render("HomePage/500");
    }
});

module.exports = router;

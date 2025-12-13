let btn = document.querySelector(".add-expense");

btn.addEventListener("click", () => {
    // document.querySelector(".expense-form").style.display = 'block';
    document.querySelector(".expense-form").classList.add("show");

});
function enableEdit(id) {
    document.getElementById("display-" + id).style.display = "none";
    document.getElementById("edit-" + id).style.display = "grid";  // grid for layout
}
function confirmDelete() {
    return confirm("Are you sure you want to delete this expense?");
}

// Search by expense name or id from input 

const searchInput = document.getElementById("searchInput");

searchInput.addEventListener("input", function () {
    const searchText = this.value.toLowerCase();
    const expenseRows = document.querySelectorAll(".expense-wrapper");

    expenseRows.forEach(row => {
        const expense = row.dataset.expense || "";
        const visible = expense.includes(searchText);
        row.style.display = visible ? "" : "none";
    });
});


window.addEventListener("DOMContentLoaded", () => {

    const ctx = document.getElementById("ExpenseLineChart").getContext("2d");

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
            datasets: [
                {
                    label: 'Expenses',
                    data: monthlyExpenseData,
                    borderColor: '#60A5FA',
                    // borderColor: '#faba43ff',

                    backgroundColor: 'rgba(96, 165, 250, 0.2)',
                    // backgroundColor: 'rgba(251, 225, 177, 0.5)',
                    fill: true,
                    tension: 0.5,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
            ]
        },
        options: {
            responsive: true,
              maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // ❌ Ye line chart ke top legend ko hata degi
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,

                    backgroundColor: 'rgba(0,0,0,0.7)',  // hover box style
                    titleFont: { size: 14 },
                    bodyFont: { size: 14 },
                    padding: 10
                }
            },

            interaction: { mode: 'index', intersect: false, axis: 'x' },
            scales: {
                x: { grid: { display: false } },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => `₹${value / 1000}K`
                    },
                    grid: { drawTicks: false }
                }
            }

        }

    });
});

let pieChart;

window.addEventListener("DOMContentLoaded", function () {

    const ctx = document.querySelector('.expense-piechart').getContext('2d');

    pieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: pieLabels,
            datasets: [{
                label: 'Expenses',
                data: pieData,
                backgroundColor: [
                    '#4F6D7A',
                    '#4DB6AC',
                    '#81C784',
                    '#F6A623',
                    '#FF8A65',
                    '#9575CD',
                    '#64B5F6',
                    '#FFD54F',
                    '#BA68C8',
                    '#EF5350'
                ],
                borderWidth: 1,
                hoverOffset: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 15, padding: 10 }
                }
            }
        }
    });

});

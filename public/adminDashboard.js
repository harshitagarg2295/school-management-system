
window.addEventListener("DOMContentLoaded", () => {
    if (monthlyIncomeData.every(v => v === 0) && monthlyExpenseData.every(v => v === 0)) {
        document.getElementById("earningsLineChart").replaceWith(
            Object.assign(document.createElement("div"), {
                innerText: "No Record Found!",
                className: "no-record"
            })
        )
    } else {
        const ctx = document.getElementById("earningsLineChart").getContext("2d");

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
                datasets: [
                    {
                        label: 'Income',
                        data: monthlyIncomeData,
                        borderColor: '#60A5FA',
                        backgroundColor: 'rgba(96, 165, 250, 0.2)',
                        fill: true,
                        tension: 0.5,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'Expense',
                        data: monthlyExpenseData,
                        borderColor: '#F87171',
                        backgroundColor: 'rgba(248, 113, 113, 0.2)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: 0   // <- pure chart ka padding remove
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        titleFont: { size: 14 },
                        bodyFont: { size: 14 },
                        padding: 10
                    }
                },
                interaction: { mode: 'index', intersect: false, axis: 'x' },
                scales: {
                    x: {
                        grid: { display: false }
                    },
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
    }
});

// Js For PieCharts
window.onload = function () {
    // Chart 1: Expenses

    if (Object.values(expensesData).every(v => v === 0)) {
        document.querySelector(".expense-chart").replaceWith(
            Object.assign(document.createElement("div"), {
                innerText: "No Record Found!",
                className: "no-record"
            })
        )
    }
    else {
        new Chart(document.querySelector(".expense-chart").getContext('2d'), {
            type: 'pie',
            data: {
                labels: Object.keys(expensesData),
                datasets: [{
                    data: Object.values(expensesData),
                    backgroundColor: ['#4F6D7A', '#4DB6AC', '#81C784', '#64B5F6', '#EF5350'],
                    hoverOffset: 3
                }]
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 15, padding: 10 }
                    }
                }
            }

        });
    }


    // Chart 2: Revenue

    if (Object.values(revenueData).every(v => v === 0)) {
        document.querySelector(".revenue-chart").replaceWith(
            Object.assign(document.createElement("div"), {
                innerText: "No Record Found!",
                className: "no-record"
            })
        )
    }
    else {
        new Chart(document.querySelector(".revenue-chart").getContext('2d'), {
            type: 'pie',
            data: {
                labels: Object.keys(revenueData),
                datasets: [{
                    data: Object.values(revenueData),
                    backgroundColor: ['#9575CD', '#FF8A65', '#FFD54F'],
                }],
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 15, padding: 10 }
                    }
                }
            }

        });
    }
};

// Toggle menu Section
const menuBtn = document.querySelector('.menu-btn');
const menuSection = document.querySelector('.menu-section');

menuBtn.addEventListener('click', () => {
    menuSection.classList.toggle('active');

});

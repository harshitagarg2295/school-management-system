
window.addEventListener("DOMContentLoaded", () => {

    const ctx = document.getElementById("feesLineChart").getContext("2d");

    window.myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
            datasets: [
                {
                    label: 'Income',
                    data: monthlyData,
                    borderColor: '#faba43ff',
                    backgroundColor: 'rgba(251, 225, 177, 0.5)',
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

window.addEventListener("resize", () => {
    if (window.myChart) {
        window.myChart.resize();
    }
});



// Search by name or id from input 

const searchInput = document.getElementById("searchInput");

searchInput.addEventListener("input", function () {
    const searchText = this.value.toLowerCase();
    const studentRows = document.querySelectorAll(".student-wrapper");

    studentRows.forEach(row => {
        const name = row.dataset.name;
        const id = row.dataset.id;
        const visible = name.includes(searchText) || id.includes(searchText);
        row.style.display = visible ? "" : "none";
    });
});

let libraryCharts = [];

function destroyLibraryCharts() {
    libraryCharts.forEach(chart => chart.destroy());
    libraryCharts = [];
}

async function loadStatistics(version) {
    destroyLibraryCharts();

    try {
        const [stats, advanced] = await Promise.all([
            apiRequest('/statistics'),
            apiRequest('/statistics/advanced')
        ]);

        if (version !== pageVersion) return;

        pageContent.innerHTML = `
            <div class="toolbar">
                <div>
                    <h3>Tổng quan hoạt động thư viện</h3>
                </div>

                <button class="btn-secondary"
                    id="refreshStatistics">
                    Làm mới
                </button>
            </div>

            <div class="stats-grid">

                ${statCard('Đầu sách', stats.total_books)}

                ${statCard('Sách vật lý', stats.total_copies)}

                ${statCard('Sách có sẵn', stats.available_copies, 'success')}

                ${statCard('Sách đang mượn', stats.borrowed_copies, 'warning')}

                ${statCard('Sách đã trả', stats.returned_books, 'success')}

                ${statCard('Sách quá hạn', stats.overdue_books, 'danger')}

                ${statCard('Độc giả', stats.total_readers)}

                ${statCard('Yêu cầu chờ duyệt', stats.pending_requests, 'warning')}

            </div>

            <div class="panel statistics-capacity">

                <h3>Sức chứa thư viện</h3>

                <div class="capacity-info">
                    <span>
                        Đã sử dụng ${Number(stats.total_copies)}
                        / ${Number(stats.max_capacity)} cuốn
                    </span>

                    <strong>
                        ${Number(stats.capacity_percentage)}%
                    </strong>
                </div>

                <div class="progress-bar">
                    <div class="progress-fill"
                        style="width: ${Math.min(
                            100,
                            Math.max(
                                0,
                                Number(stats.capacity_percentage) || 0
                            )
                        )}%">
                    </div>
                </div>

                <p class="capacity-note">
                    Có thể bổ sung thêm
                    ${Number(stats.remaining_capacity)} cuốn sách.
                </p>

            </div>

            <div class="statistics-grid">

                <section class="panel">
                    <h3>Tình trạng sách</h3>

                    <div class="chart-container">
                        <canvas id="bookStatusChart"></canvas>
                    </div>
                </section>

                <section class="panel">
                    <h3>Trạng thái yêu cầu mượn</h3>

                    <div class="chart-container">
                        <canvas id="requestStatusChart"></canvas>
                    </div>
                </section>

                <section class="panel statistics-full">
                    <h3>Hoạt động mượn và trả sách trong 6 tháng</h3>

                    <div class="chart-container chart-wide">
                        <canvas id="monthlyChart"></canvas>
                    </div>
                </section>

                <section class="panel statistics-full">
                    <h3>Top 5 sách được mượn nhiều nhất</h3>

                    <div class="chart-container chart-wide">
                        <canvas id="popularBooksChart"></canvas>
                    </div>
                </section>

                <section class="panel statistics-full">
                    <h3>Thống kê theo danh mục</h3>

                    ${renderCategoryStatistics(
                        advanced.category_statistics || []
                    )}
                </section>

            </div>
        `;

        document.getElementById('refreshStatistics')
            .addEventListener('click', () => {
                navigateTo('statistics');
            });

        if (typeof Chart === 'undefined') {
            document.querySelectorAll('.chart-container')
                .forEach(container => {
                    container.innerHTML = `
                        <div class="error-message">
                            Không thể tải thư viện Chart.js.
                            Vui lòng kiểm tra kết nối Internet.
                        </div>
                    `;
                });

            return;
        }

        renderLibraryCharts(stats, advanced);

    } catch (error) {
        if (version !== pageVersion) return;

        destroyLibraryCharts();

        pageContent.innerHTML = `
            <div class="error-message">
                ${escapeHTML(error.message)}
            </div>
        `;
    }
}

function renderCategoryStatistics(categories) {
    if (!categories.length) {
        return `
            <div class="empty-message">
                Chưa có dữ liệu danh mục.
            </div>
        `;
    }

    return `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Danh mục</th>
                        <th>Đầu sách</th>
                        <th>Sách vật lý</th>
                        <th>Có sẵn</th>
                        <th>Đang mượn</th>
                    </tr>
                </thead>

                <tbody>
                    ${categories.map(category => `
                        <tr>
                            <td>
                                ${escapeHTML(category.name)}
                            </td>

                            <td>
                                ${Number(category.total_books)}
                            </td>

                            <td>
                                ${Number(category.total_copies)}
                            </td>

                            <td>
                                <span class="status-badge status-success">
                                    ${Number(category.available_copies)}
                                </span>
                            </td>

                            <td>
                                <span class="status-badge status-warning">
                                    ${Number(category.borrowed_copies)}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function getChartTheme() {
    const styles = getComputedStyle(document.body);

    return {
        text: styles.getPropertyValue('--text').trim(),
        border: styles.getPropertyValue('--border').trim(),
        surface: styles.getPropertyValue('--surface').trim()
    };
}

function createLibraryChart(id, config) {
    const canvas = document.getElementById(id);

    if (!canvas) return;

    const chart = new Chart(canvas, config);

    libraryCharts.push(chart);
}

function renderLibraryCharts(stats, advanced) {
    destroyLibraryCharts();

    const theme = getChartTheme();

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        color: theme.text
    };

    const legendOptions = {
        position: 'bottom',
        labels: {
            color: theme.text,
            padding: 20
        }
    };

    const scaleOptions = {
        x: {
            ticks: {
                color: theme.text
            },
            grid: {
                color: theme.border
            }
        },

        y: {
            beginAtZero: true,
            ticks: {
                color: theme.text,
                precision: 0
            },
            grid: {
                color: theme.border
            }
        }
    };

    createLibraryChart('bookStatusChart', {
        type: 'doughnut',

        data: {
            labels: ['Có sẵn', 'Đang mượn'],

            datasets: [{
                data: [
                    Number(stats.available_copies),
                    Number(stats.borrowed_copies)
                ],

                backgroundColor: [
                    '#22c55e',
                    '#f59e0b'
                ],

                borderColor: theme.surface,
                borderWidth: 3
            }]
        },

        options: {
            ...commonOptions,

            cutout: '65%',

            plugins: {
                legend: legendOptions
            }
        }
    });

    createLibraryChart('requestStatusChart', {
        type: 'doughnut',

        data: {
            labels: [
                'Chờ duyệt',
                'Đã duyệt',
                'Từ chối',
                'Đã hủy'
            ],

            datasets: [{
                data: [
                    Number(stats.pending_requests),
                    Number(stats.approved_requests),
                    Number(stats.rejected_requests),
                    Number(stats.cancelled_requests)
                ],

                backgroundColor: [
                    '#f59e0b',
                    '#22c55e',
                    '#ef4444',
                    '#94a3b8'
                ],

                borderColor: theme.surface,
                borderWidth: 3
            }]
        },

        options: {
            ...commonOptions,

            cutout: '65%',

            plugins: {
                legend: legendOptions
            }
        }
    });

    const monthly = advanced.monthly_statistics || [];

    createLibraryChart('monthlyChart', {
        type: 'bar',

        data: {
            labels: monthly.map(item => item.month),

            datasets: [
                {
                    label: 'Sách được mượn',

                    data: monthly.map(
                        item => Number(item.borrowed_books)
                    ),

                    backgroundColor: '#2563eb',
                    borderRadius: 5
                },

                {
                    label: 'Sách đã trả',

                    data: monthly.map(
                        item => Number(item.returned_books)
                    ),

                    backgroundColor: '#22c55e',
                    borderRadius: 5
                }
            ]
        },

        options: {
            ...commonOptions,

            plugins: {
                legend: legendOptions
            },

            scales: scaleOptions
        }
    });

    const popular = advanced.popular_books || [];

    if (!popular.length) {
        document.getElementById('popularBooksChart')
            .parentElement.innerHTML = `
                <div class="empty-message">
                    Chưa có dữ liệu lượt mượn sách.
                </div>
            `;

        return;
    }

    createLibraryChart('popularBooksChart', {
        type: 'bar',

        data: {
            labels: popular.map(item => item.title),

            datasets: [{
                label: 'Lượt mượn',

                data: popular.map(
                    item => Number(item.total_borrows)
                ),

                backgroundColor: '#2563eb',
                borderRadius: 5
            }]
        },

        options: {
            ...commonOptions,

            indexAxis: 'y',

            plugins: {
                legend: {
                    display: false
                }
            },

            scales: {
                x: {
                    beginAtZero: true,

                    ticks: {
                        color: theme.text,
                        precision: 0
                    },

                    grid: {
                        color: theme.border
                    }
                },

                y: {
                    ticks: {
                        color: theme.text
                    },

                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

document.getElementById('themeToggle')
    ?.addEventListener('click', () => {
        requestAnimationFrame(() => {
            if (
                currentPage === 'statistics' &&
                libraryCharts.length
            ) {
                const theme = getChartTheme();

                libraryCharts.forEach(chart => {
                    chart.options.color = theme.text;

                    if (chart.options.plugins?.legend?.labels) {
                        chart.options.plugins.legend.labels.color =
                            theme.text;
                    }

                    Object.values(chart.options.scales || {})
                        .forEach(scale => {
                            if (scale.ticks) {
                                scale.ticks.color = theme.text;
                            }

                            if (scale.grid) {
                                scale.grid.color = theme.border;
                            }
                        });

                    if (chart.config.type === 'doughnut') {
                        chart.data.datasets.forEach(dataset => {
                            dataset.borderColor = theme.surface;
                        });
                    }

                    chart.update();
                });
            }
        });
    });
const pageTitle = document.getElementById('pageTitle');
const pageDescription = document.getElementById('pageDescription');
const pageContent = document.getElementById('pageContent');
const sidebar = document.getElementById('sidebar');

const pages = {
    dashboard: {
        title: 'Tổng quan',
        description: 'Theo dõi hoạt động của thư viện'
    },
    books: {
        title: 'Quản lý sách',
        description: 'Thêm, chỉnh sửa và tìm kiếm sách'
    },
    categories: {
        title: 'Danh mục sách',
        description: 'Quản lý các danh mục trong thư viện'
    },
    copies: {
        title: 'Bản sao sách',
        description: 'Quản lý mã riêng của từng cuốn sách'
    },
    requests: {
        title: 'Yêu cầu mượn sách',
        description: 'Phê duyệt hoặc từ chối yêu cầu mượn'
    },
    activeLoans: {
        title: 'Danh sách đang mượn',
        description: 'Quản lý các phiếu mượn đang hoạt động'
    },
    returnedLoans: {
        title: 'Danh sách đã trả',
        description: 'Theo dõi lịch sử trả sách'
    },
    overdueLoans: {
        title: 'Sách quá hạn',
        description: 'Theo dõi các phiếu mượn quá hạn'
    },
    users: {
        title: 'Quản lý tài khoản',
        description: 'Quản lý tài khoản người dùng'
    },
    statistics: {
        title: 'Thống kê',
        description: 'Thống kê hoạt động của thư viện'
    }
};

let currentPage = 'dashboard';
let pageVersion = 0;

function statCard(title, value, type = '') {
    return `
        <div class="stat-card ${type}">
            <h3>${title}</h3>
            <div class="stat-value">${Number(value) || 0}</div>
        </div>
    `;
}

function infoRow(title, value) {
    return `
        <div class="info-row">
            <span>${title}</span>
            <strong>${Number(value) || 0}</strong>
        </div>
    `;
}

async function loadDashboard(version) {
    try {
        const data = await apiRequest('/statistics');

        if (version !== pageVersion) return;

        const percentage = Math.min(
            100,
            Math.max(0, Number(data.capacity_percentage) || 0)
        );

        pageContent.innerHTML = `
            <div class="stats-grid">

                ${statCard('Tổng đầu sách', data.total_books)}

                ${statCard('Tổng sách vật lý', data.total_copies)}

                ${statCard('Sách có sẵn', data.available_copies, 'success')}

                ${statCard('Sách đang mượn', data.borrowed_copies)}

                ${statCard('Yêu cầu chờ duyệt', data.pending_requests, 'warning')}

                ${statCard('Sách quá hạn', data.overdue_books, 'danger')}

                ${statCard('Lượt sách đã trả', data.returned_books, 'success')}

                ${statCard('Tổng độc giả', data.total_readers)}

            </div>

            <section class="panel">
                <h3>Sức chứa thư viện</h3>

                <div class="capacity-info">
                    <span>
                        ${Number(data.total_copies)} /
                        ${Number(data.max_capacity)} cuốn
                    </span>

                    <strong>${percentage}%</strong>
                </div>

                <div class="progress-bar">
                    <div class="progress-fill"
                        style="width: ${percentage}%">
                    </div>
                </div>

                <p class="capacity-note">
                    Có thể thêm ${Number(data.remaining_capacity)} cuốn sách.
                </p>
            </section>

            <div class="dashboard-columns">

                <section class="panel">
                    <h3>Thống kê yêu cầu mượn</h3>

                    ${infoRow('Chờ duyệt', data.pending_requests)}
                    ${infoRow('Đã phê duyệt', data.approved_requests)}
                    ${infoRow('Đã từ chối', data.rejected_requests)}
                    ${infoRow('Đã hủy', data.cancelled_requests)}
                </section>

                <section class="panel">
                    <h3>Thông tin hệ thống</h3>

                    ${infoRow('Danh mục sách', data.total_categories)}
                    ${infoRow('Độc giả đang hoạt động', data.active_readers)}
                    ${infoRow('Tài khoản quản trị', data.total_admins)}
                    ${infoRow('Phiếu mượn đang hoạt động', data.active_loans)}
                    ${infoRow('Phiếu mượn đã hoàn thành', data.returned_loans)}
                    ${infoRow('Phiếu mượn quá hạn', data.overdue_loans)}
                </section>

            </div>
        `;

    } catch (error) {
        if (version !== pageVersion) return;

        const message = document.createElement('div');
        message.className = 'error-message';
        message.textContent = error.message;

        pageContent.replaceChildren(message);
    }
}

async function navigateTo(page) {
    if (!pages[page]) return;

    closeModal();
    destroyLibraryCharts();

    currentPage = page;
    const version = ++pageVersion;

    pageTitle.textContent = pages[page].title;
    pageDescription.textContent = pages[page].description;

    document.querySelectorAll('.menu-item').forEach(button => {
        button.classList.toggle(
            'active',
            button.dataset.page === page
        );
    });

    sidebar.classList.remove('open');

    pageContent.innerHTML = `
        <div class="loading-message">
            Đang tải dữ liệu...
        </div>
    `;

    switch (page) {
        case 'dashboard':
            await loadDashboard(version);
            break;

        case 'books':
            await loadBooks(version);
            break;

        case 'categories':
            await loadCategories(version);
            break;

        case 'copies':
            await loadCopies(version);
            break;

        case 'requests':
            await loadBorrowRequests(version);
            break;

        case 'activeLoans':
        case 'returnedLoans':
        case 'overdueLoans':
            await loadLoans(version, page);
            break;

        case 'users':
            await loadUsers(version);
            break;

        case 'statistics':
            await loadStatistics(version);
            break;

        default:
            pageContent.innerHTML = `
                <div class="panel empty-message">
                    Chức năng đang được xây dựng.
                </div>
            `;
    }
}

function initializeAdmin() {
    if (!requireAuth(['super_admin', 'librarian'])) {
        return;
    }

    const user = getUser();

    document.getElementById('adminName').textContent =
        user.full_name || user.username;

    document.getElementById('logoutButton')
        .addEventListener('click', logout);

    document.getElementById('menuToggle')
        .addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });

    document.addEventListener('click', event => {
        if (
            !sidebar.contains(event.target) &&
            !event.target.closest('#menuToggle')
        ) {
            sidebar.classList.remove('open');
        }
    });

    document.querySelectorAll('.menu-item').forEach(button => {
        button.addEventListener('click', () => {
            navigateTo(button.dataset.page);
        });
    });

    navigateTo('dashboard');
}

initializeAdmin();
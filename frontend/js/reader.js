const pageTitle = document.getElementById('pageTitle');
const pageDescription = document.getElementById('pageDescription');
const pageContent = document.getElementById('pageContent');
const sidebar = document.getElementById('sidebar');

const MAX_BORROW_BOOKS = 3;
const LOAN_DURATION_DAYS = 14;

let currentPage = 'dashboard';
let pageVersion = 0;

const pages = {
    dashboard: {
        title: 'Trang chủ',
        description: 'Tổng quan hoạt động của bạn'
    },

    books: {
        title: 'Tra cứu sách',
        description: 'Tìm kiếm và khám phá sách trong thư viện'
    },

    aiSearch: {
        title: 'Tìm kiếm AI',
        description: 'Tìm sách theo nội dung và ngữ nghĩa'
    },

    borrowCart: {
        title: 'Phiếu mượn',
        description: 'Danh sách sách bạn muốn đăng ký mượn'
    },

    requests: {
        title: 'Yêu cầu của tôi',
        description: 'Theo dõi trạng thái yêu cầu mượn sách'
    },

    activeLoans: {
        title: 'Sách đang mượn',
        description: 'Theo dõi sách đang mượn và thời hạn trả'
    },

    history: {
        title: 'Lịch sử mượn',
        description: 'Danh sách các sách đã trả'
    },

    profile: {
        title: 'Tài khoản của tôi',
        description: 'Thông tin tài khoản độc giả'
    }
};

function readerStatCard(title, value, type = '') {
    return `
        <div class="stat-card ${type}">
            <h3>${escapeHTML(title)}</h3>
            <strong>${Number(value) || 0}</strong>
        </div>
    `;
}

function readerInfoRow(label, value) {
    return `
        <div class="reader-info-row">
            <span>${escapeHTML(label)}</span>
            <strong>${escapeHTML(value)}</strong>
        </div>
    `;
}

async function loadReaderDashboard(version) {
    try {
        const [requests, loans, capacity] = await Promise.all([
            apiRequest('/borrow-requests/my'),
            apiRequest('/loans/my'),
            apiRequest('/copies/capacity')
        ]);

        if (version !== pageVersion) return;

        const user = getUser();

        const activeLoans = loans.filter(
            loan => loan.status === 'active'
        );

        const borrowedBooks = activeLoans.reduce(
            (sum, loan) => sum + Number(loan.borrowed_books || 0),
            0
        );

        const returnedBooks = loans.reduce(
            (sum, loan) => sum + Number(loan.returned_books || 0),
            0
        );

        const overdueBooks = activeLoans
            .filter(loan => loan.is_overdue)
            .reduce(
                (sum, loan) =>
                    sum + Number(loan.borrowed_books || 0),
                0
            );

        const pendingRequests = requests.filter(
            request => request.status === 'pending'
        ).length;

        const approvedRequests = requests.filter(
            request => request.status === 'approved'
        ).length;

        const rejectedRequests = requests.filter(
            request => request.status === 'rejected'
        ).length;

        const cancelledRequests = requests.filter(
            request => request.status === 'cancelled'
        ).length;

        const remainingBooks = overdueBooks > 0
            ? 0
            : Math.max(0, MAX_BORROW_BOOKS - borrowedBooks);

        const borrowPercentage = Math.min(
            100,
            borrowedBooks / MAX_BORROW_BOOKS * 100
        );

        pageContent.innerHTML = `
            <section class="reader-welcome">

                <h2>
                    Xin chào, ${escapeHTML(user.full_name)}!
                </h2>

                <p>
                    Chào mừng bạn đến với hệ thống quản lý thư viện.
                    Hãy tìm kiếm và đăng ký mượn những cuốn sách
                    phù hợp với nhu cầu học tập của bạn.
                </p>

                <button id="exploreBooks">
                    Khám phá sách
                </button>

            </section>

            ${overdueBooks > 0 ? `
                <div class="reader-alert">
                    Bạn có ${overdueBooks} cuốn sách quá hạn.
                    Vui lòng trả sách trước khi đăng ký mượn thêm.
                </div>
            ` : ''}

            <div class="stats-grid">

                ${readerStatCard(
                    'Sách đang mượn',
                    borrowedBooks,
                    'warning'
                )}

                ${readerStatCard(
                    'Sách đã trả',
                    returnedBooks,
                    'success'
                )}

                ${readerStatCard(
                    'Yêu cầu chờ duyệt',
                    pendingRequests
                )}

                ${readerStatCard(
                    'Sách quá hạn',
                    overdueBooks,
                    'danger'
                )}

            </div>

            <div class="reader-dashboard-grid">

                <section class="panel">

                    <h3>Giới hạn mượn sách</h3>

                    ${readerInfoRow(
                        'Đang mượn',
                        `${borrowedBooks} / ${MAX_BORROW_BOOKS} cuốn`
                    )}

                    <div class="progress-bar">

                        <div class="progress-fill"
                            style="width: ${borrowPercentage}%">
                        </div>

                    </div>

                    <p class="capacity-note">
                        ${overdueBooks > 0
                            ? 'Bạn đang bị hạn chế mượn do có sách quá hạn.'
                            : `Bạn có thể mượn thêm tối đa ${remainingBooks} cuốn.`}
                    </p>

                    ${readerInfoRow(
                        'Thời hạn mượn',
                        `${LOAN_DURATION_DAYS} ngày`
                    )}

                </section>

                <section class="panel">

                    <h3>Yêu cầu mượn sách</h3>

                    ${readerInfoRow(
                        'Chờ phê duyệt',
                        pendingRequests
                    )}

                    ${readerInfoRow(
                        'Đã phê duyệt',
                        approvedRequests
                    )}

                    ${readerInfoRow(
                        'Đã từ chối',
                        rejectedRequests
                    )}

                    ${readerInfoRow(
                        'Đã hủy',
                        cancelledRequests
                    )}

                </section>

                <section class="panel">

                    <h3>Thông tin thư viện</h3>

                    ${readerInfoRow(
                        'Tổng số sách vật lý',
                        capacity.total_copies
                    )}

                    ${readerInfoRow(
                        'Sức chứa tối đa',
                        capacity.max_capacity
                    )}

                    ${readerInfoRow(
                        'Hình thức mượn',
                        'Thủ thư phê duyệt'
                    )}

                </section>

                <section class="panel">

                    <h3>Quy định mượn sách</h3>

                    <ul class="reader-rules">

                        <li>Mỗi độc giả được mượn tối đa 3 cuốn.</li>

                        <li>Thời hạn mượn sách là 14 ngày.</li>

                        <li>Yêu cầu mượn phải được phê duyệt.</li>

                        <li>Không được mượn thêm khi có sách quá hạn.</li>

                        <li>Trả sách trực tiếp tại thư viện.</li>

                    </ul>

                </section>

            </div>
        `;

        document.getElementById('exploreBooks')
            .addEventListener('click', () => {
                navigateTo('books');
            });

    } catch (error) {
        if (version !== pageVersion) return;

        pageContent.innerHTML = `
            <div class="error-message">
                ${escapeHTML(error.message)}
            </div>
        `;
    }
}

async function loadReaderProfile(version) {
    if (version !== pageVersion) return;

    const user = getUser();

    pageContent.innerHTML = `
        <section class="panel">

            <h3>Thông tin cá nhân</h3>

            ${readerInfoRow(
                'Họ và tên',
                user.full_name || '—'
            )}

            ${readerInfoRow(
                'Tên đăng nhập',
                user.username || '—'
            )}

            ${readerInfoRow(
                'MSSV',
                user.mssv || 'Chưa cập nhật'
            )}

            ${readerInfoRow(
                'Lớp',
                user.class_name || 'Chưa cập nhật'
            )}

            ${readerInfoRow(
                'Quyền tài khoản',
                'Độc giả'
            )}

            <p class="capacity-note">
                Liên hệ thủ thư nếu bạn cần cập nhật thông tin
                hoặc đặt lại mật khẩu.
            </p>

        </section>
    `;
}

async function navigateTo(page) {
    if (!pages[page]) return;

    closeModal();

    currentPage = page;
    const version = ++pageVersion;

    pageTitle.textContent = pages[page].title;
    pageDescription.textContent = pages[page].description;

    document.querySelectorAll('.menu-item')
        .forEach(button => {
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
            await loadReaderDashboard(version);
            break;

        case 'books':
            await loadReaderBooks(version);
            break;

        case 'aiSearch':
            loadReaderAISearch(version);
            break;

        case 'borrowCart':
            await loadBorrowCart(version);
            break;

        case 'requests':
            await loadReaderRequests(version);
            break;

        case 'activeLoans':
        case 'history':
            await loadReaderLoans(version, page);
            break;

        case 'profile':
            await loadReaderProfile(version);
            break;

        default:
            pageContent.innerHTML = `
                <div class="panel empty-message">
                    Không tìm thấy chức năng.
                </div>
            `;
    }
}

function initializeReader() {
    if (!requireAuth(['reader'])) return;

    const user = getUser();

    document.getElementById('readerName')
        .textContent = user.full_name;

    document.getElementById('profileName')
        .textContent = user.full_name;

    const initials = (user.full_name || 'SV')
        .trim()
        .split(/\s+/)
        .slice(-2)
        .map(word => word.charAt(0))
        .join('')
        .toUpperCase();

    document.getElementById('readerAvatar')
        .textContent = initials;

    document.getElementById('logoutButton')
        .addEventListener('click', logout);

    document.getElementById('menuToggle')
        .addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });

    document.addEventListener('click', event => {
        if (
            !sidebar.contains(event.target) &&
            !document.getElementById('menuToggle')
                .contains(event.target)
        ) {
            sidebar.classList.remove('open');
        }
    });

    document.querySelectorAll('.menu-item')
        .forEach(button => {
            button.addEventListener('click', () => {
                navigateTo(button.dataset.page);
            });
        });

    navigateTo('dashboard');
}

initializeReader();
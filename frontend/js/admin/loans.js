let adminLoans = [];

const loanEndpoints = {
    activeLoans: '/loans/active',
    returnedLoans: '/loans/returned',
    overdueLoans: '/loans/overdue'
};

function formatLoanDate(value) {
    if (!value) return 'Chưa trả';

    return new Date(value).toLocaleString('vi-VN');
}

function loanStatusBadge(loan) {
    if (loan.status === 'returned') {
        return `
            <span class="status-badge status-success">
                Đã trả
            </span>
        `;
    }

    if (loan.is_overdue) {
        return `
            <span class="status-badge status-danger">
                Quá hạn
            </span>
        `;
    }

    return `
        <span class="status-badge status-warning">
            Đang mượn
        </span>
    `;
}

async function loadLoans(version, page) {
    try {
        const endpoint = loanEndpoints[page];

        const data = await apiRequest(endpoint);

        if (version !== pageVersion) return;

        adminLoans = data;

        const borrowedBooks = data.reduce(
            (sum, loan) => sum + Number(loan.borrowed_books || 0),
            0
        );

        const returnedBooks = data.reduce(
            (sum, loan) => sum + Number(loan.returned_books || 0),
            0
        );

        const overdueLoans = data.filter(
            loan => loan.is_overdue
        ).length;

        pageContent.innerHTML = `
            <div class="stats-grid">

                ${statCard('Tổng phiếu mượn', data.length)}

                ${statCard('Sách chưa trả', borrowedBooks, 'warning')}

                ${statCard('Sách đã trả', returnedBooks, 'success')}

                ${statCard('Phiếu quá hạn', overdueLoans, 'danger')}

            </div>

            <div class="toolbar">
                <div class="toolbar-filters">

                    <input type="search"
                        id="loanSearch"
                        class="search-input"
                        placeholder="Tìm độc giả, MSSV hoặc mã sách...">

                </div>

                <button class="btn-secondary"
                    id="refreshLoans">
                    Làm mới
                </button>
            </div>

            <div id="loanTable"></div>
        `;

        document.getElementById('loanSearch')
            .addEventListener('input', renderLoanTable);

        document.getElementById('refreshLoans')
            .addEventListener('click', () => {
                navigateTo(page);
            });

        document.getElementById('loanTable')
            .addEventListener('click', handleLoanAction);

        renderLoanTable();

    } catch (error) {
        if (version !== pageVersion) return;

        pageContent.innerHTML = `
            <div class="error-message">
                ${escapeHTML(error.message)}
            </div>
        `;
    }
}

function renderLoanTable() {
    const table = document.getElementById('loanTable');

    if (!table) return;

    const search = document.getElementById('loanSearch')
        .value.trim().toLowerCase();

    const loans = adminLoans.filter(loan => {
        const content = [
            loan.id,
            loan.full_name,
            loan.mssv,
            ...(loan.items || []).map(item =>
                `${item.title} ${item.copy_code}`
            )
        ].join(' ').toLowerCase();

        return content.includes(search);
    });

    if (!loans.length) {
        table.innerHTML = `
            <div class="panel empty-message">
                Không tìm thấy phiếu mượn.
            </div>
        `;
        return;
    }

    table.innerHTML = `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Mã phiếu</th>
                        <th>Độc giả</th>
                        <th>MSSV</th>
                        <th>Chưa trả</th>
                        <th>Đã trả</th>
                        <th>Ngày mượn</th>
                        <th>Hạn trả</th>

                        ${currentPage === 'returnedLoans'
                            ? '<th>Ngày trả</th>'
                            : ''}

                        <th>Trạng thái</th>
                        <th>Thao tác</th>
                    </tr>
                </thead>

                <tbody>
                    ${loans.map(loan => `
                        <tr>
                            <td>#${Number(loan.id)}</td>

                            <td>${escapeHTML(loan.full_name)}</td>

                            <td>${escapeHTML(loan.mssv)}</td>

                            <td>${Number(loan.borrowed_books)}</td>

                            <td>${Number(loan.returned_books)}</td>

                            <td>
                                ${escapeHTML(formatLoanDate(loan.borrow_date))}
                            </td>

                            <td class="${loan.is_overdue ? 'overdue-date' : ''}">
                                ${escapeHTML(formatLoanDate(loan.due_date))}
                            </td>

                            ${currentPage === 'returnedLoans' ? `
                                <td>
                                    ${escapeHTML(formatLoanDate(loan.return_date))}
                                </td>
                            ` : ''}

                            <td>${loanStatusBadge(loan)}</td>

                            <td>
                                <div class="action-group">

                                    <button class="btn-view"
                                        data-action="view"
                                        data-id="${Number(loan.id)}">
                                        Xem
                                    </button>

                                    ${loan.status === 'active' ? `
                                        <button class="btn-primary"
                                            data-action="return-all"
                                            data-id="${Number(loan.id)}">
                                            Trả tất cả
                                        </button>
                                    ` : ''}

                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function handleLoanAction(event) {
    const button = event.target.closest('button[data-action]');

    if (!button || button.disabled) return;

    const id = Number(button.dataset.id);

    const loan = adminLoans.find(
        item => Number(item.id) === id
    );

    if (!loan) return;

    if (button.dataset.action === 'view') {
        viewLoan(id);
    }

    if (button.dataset.action === 'return-all') {
        returnAllBooks(loan);
    }
}

function loanDetailRow(label, value) {
    return `
        <div class="detail-row">
            <strong>${escapeHTML(label)}</strong>
            <span>${escapeHTML(value)}</span>
        </div>
    `;
}

async function viewLoan(id) {
    const version = pageVersion;

    try {
        const loan = await apiRequest(`/loans/${id}`);

        if (version !== pageVersion) return;

        openModal(
            `Chi tiết phiếu mượn #${loan.id}`,
            `
                ${loanDetailRow('Họ và tên', loan.full_name)}

                ${loanDetailRow('MSSV', loan.mssv)}

                ${loanDetailRow('Lớp', loan.class_name)}

                ${loanDetailRow(
                    'Người phê duyệt',
                    loan.approved_by_name
                )}

                ${loanDetailRow(
                    'Ngày mượn',
                    formatLoanDate(loan.borrow_date)
                )}

                ${loanDetailRow(
                    'Hạn trả',
                    formatLoanDate(loan.due_date)
                )}

                ${loanDetailRow(
                    'Ngày hoàn thành',
                    formatLoanDate(loan.return_date)
                )}

                <div class="detail-row">
                    <strong>Trạng thái</strong>
                    <span>${loanStatusBadge(loan)}</span>
                </div>

                <h3 class="request-books-title">
                    Danh sách sách trong phiếu
                </h3>

                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Mã sách</th>
                                <th>Tên sách</th>
                                <th>Trạng thái</th>
                                <th>Ngày trả</th>
                                <th>Thao tác</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${(loan.items || []).map(item => `
                                <tr>
                                    <td>
                                        ${escapeHTML(item.copy_code)}
                                    </td>

                                    <td>
                                        ${escapeHTML(item.title)}
                                    </td>

                                    <td>
                                        <span class="status-badge
                                            ${item.status === 'returned'
                                                ? 'status-success'
                                                : 'status-warning'}">

                                            ${item.status === 'returned'
                                                ? 'Đã trả'
                                                : 'Đang mượn'}

                                        </span>
                                    </td>

                                    <td>
                                        ${escapeHTML(formatLoanDate(item.return_date))}
                                    </td>

                                    <td>
                                        ${item.status === 'borrowed' ? `
                                            <button class="btn-primary return-item-button"
                                                data-id="${Number(item.loan_item_id)}">
                                                Trả sách
                                            </button>
                                        ` : '—'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `,
            `
                <button class="btn-secondary"
                    id="closeLoanDetail">
                    Đóng
                </button>

                ${loan.status === 'active' ? `
                    <button class="btn-primary"
                        id="returnAllDetail">
                        Trả tất cả
                    </button>
                ` : ''}
            `
        );

        document.getElementById('closeLoanDetail')
            .addEventListener('click', closeModal);

        document.getElementById('returnAllDetail')
            ?.addEventListener('click', () => {
                returnAllBooks(loan);
            });

        document.querySelectorAll('.return-item-button')
            .forEach(button => {
                button.addEventListener('click', () => {
                    returnSingleBook(
                        Number(button.dataset.id),
                        loan.id
                    );
                });
            });

    } catch (error) {
        if (version !== pageVersion) return;

        alert(error.message);
    }
}

async function returnSingleBook(itemId, loanId) {
    if (!confirm('Xác nhận độc giả đã trả cuốn sách này?')) {
        return;
    }

    const page = currentPage;
    const version = pageVersion;

    const buttons = document.querySelectorAll(
        '#modalOverlay button'
    );

    buttons.forEach(button => {
        button.disabled = true;
    });

    try {
        const result = await apiRequest(
            `/loans/items/${itemId}/return`,
            {
                method: 'PATCH'
            }
        );

        alert(result.message || 'Trả sách thành công');

        if (version !== pageVersion) return;

        await navigateTo(page);

        if (
            currentPage === page &&
            pageVersion === version + 1 &&
            result.loan_status !== 'returned'
        ) {
            await viewLoan(loanId);
        }

    } catch (error) {
        alert(error.message);

    } finally {
        buttons.forEach(button => {
            button.disabled = false;
        });
    }
}

async function returnAllBooks(loan) {
    if (loan.status !== 'active') return;

    if (!confirm(
        `Xác nhận trả toàn bộ sách còn lại trong phiếu #${loan.id}?`
    )) {
        return;
    }

    const page = currentPage;
    const version = pageVersion;

    const buttons = document.querySelectorAll(
        '#loanTable button, #modalOverlay button'
    );

    buttons.forEach(button => {
        button.disabled = true;
    });

    try {
        const result = await apiRequest(
            `/loans/${loan.id}/return`,
            {
                method: 'PATCH'
            }
        );

        alert(result.message || 'Trả toàn bộ sách thành công');

        if (version === pageVersion) {
            await navigateTo(page);
        }

    } catch (error) {
        alert(error.message);

    } finally {
        buttons.forEach(button => {
            button.disabled = false;
        });
    }
}
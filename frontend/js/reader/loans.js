let readerLoanItems = [];

async function loadReaderLoans(version, page) {
    try {
        const loans = await apiRequest('/loans/my');

        if (version !== pageVersion) return;

        const isHistory = page === 'history';

        readerLoanItems = loans.flatMap(loan =>
            (loan.items || [])
                .filter(item =>
                    isHistory
                        ? item.status === 'returned'
                        : item.status === 'borrowed'
                )
                .map(item => ({
                    ...item,
                    loan_id: loan.id,
                    borrow_date: loan.borrow_date,
                    due_date: loan.due_date,
                    approved_by_name: loan.approved_by_name,
                    is_overdue:
                        item.status === 'borrowed' &&
                        loan.is_overdue
                }))
        );

        const overdue = readerLoanItems.filter(
            item => item.is_overdue
        ).length;

        pageContent.innerHTML = `
            <div class="stats-grid">

                ${readerStatCard(
                    isHistory ? 'Sách đã trả' : 'Sách đang mượn',
                    readerLoanItems.length,
                    isHistory ? 'success' : 'warning'
                )}

                ${!isHistory ? `
                    ${readerStatCard(
                        'Sách quá hạn',
                        overdue,
                        'danger'
                    )}

                    ${readerStatCard(
                        'Sách còn trong hạn',
                        readerLoanItems.length - overdue,
                        'success'
                    )}
                ` : ''}

            </div>

            ${overdue > 0 ? `
                <div class="reader-alert">
                    Bạn có ${overdue} cuốn sách quá hạn.
                    Vui lòng đến thư viện để trả sách.
                </div>
            ` : ''}

            <div class="toolbar">

                <div class="toolbar-filters">

                    <input type="search"
                        id="myLoanSearch"
                        class="search-input"
                        placeholder="Tìm tên sách hoặc mã sách...">

                    ${!isHistory ? `
                        <select id="myLoanFilter">
                            <option value="">Tất cả trạng thái</option>
                            <option value="active">Trong hạn</option>
                            <option value="overdue">Quá hạn</option>
                        </select>
                    ` : ''}

                </div>

                <button class="btn-secondary"
                    id="refreshMyLoans">
                    Làm mới
                </button>

            </div>

            <div id="myLoanTable"></div>

            ${!isHistory ? `
                <p class="capacity-note loan-return-note">
                    Để trả sách, vui lòng mang sách đến thư viện.
                    Thủ thư sẽ xác nhận việc trả sách trên hệ thống.
                </p>
            ` : ''}
        `;

        document.getElementById('myLoanSearch')
            .addEventListener('input', renderReaderLoans);

        document.getElementById('myLoanFilter')
            ?.addEventListener('change', renderReaderLoans);

        document.getElementById('refreshMyLoans')
            .addEventListener('click', () => navigateTo(page));

        document.getElementById('myLoanTable')
            .addEventListener('click', handleReaderLoanAction);

        renderReaderLoans();

    } catch (error) {
        if (version !== pageVersion) return;

        pageContent.innerHTML = `
            <div class="error-message">
                ${escapeHTML(error.message)}
            </div>
        `;
    }
}

function readerLoanBadge(item) {
    if (item.status === 'returned') {
        return `
            <span class="status-badge status-success">
                Đã trả
            </span>
        `;
    }

    if (item.is_overdue) {
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

function renderReaderLoans() {
    const table = document.getElementById('myLoanTable');

    if (!table) return;

    const isHistory = currentPage === 'history';

    const search = document.getElementById('myLoanSearch')
        .value.trim().toLowerCase();

    const status = document.getElementById('myLoanFilter')
        ?.value || '';

    const items = readerLoanItems.filter(item => {
        const content = [
            item.title,
            item.author,
            item.copy_code,
            item.loan_id
        ].join(' ').toLowerCase();

        const matchStatus =
            !status ||
            (status === 'overdue' && item.is_overdue) ||
            (status === 'active' && !item.is_overdue);

        return content.includes(search) && matchStatus;
    });

    if (!items.length) {
        table.innerHTML = `
            <div class="panel empty-message">
                ${isHistory
                    ? 'Không có sách đã trả phù hợp.'
                    : 'Không có sách đang mượn phù hợp.'}
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
                        <th>Mã sách</th>
                        <th>Tên sách</th>
                        <th>Ngày mượn</th>
                        <th>Hạn trả</th>

                        ${isHistory ? '<th>Ngày trả</th>' : ''}

                        <th>Trạng thái</th>
                        <th>Thao tác</th>
                    </tr>
                </thead>

                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td>#${Number(item.loan_id)}</td>

                            <td>
                                <strong>
                                    ${escapeHTML(item.copy_code)}
                                </strong>
                            </td>

                            <td>${escapeHTML(item.title)}</td>

                            <td>
                                ${escapeHTML(
                                    readerFormatDate(item.borrow_date)
                                )}
                            </td>

                            <td class="${item.is_overdue
                                ? 'reader-overdue-date'
                                : ''}">
                                ${escapeHTML(
                                    readerFormatDate(item.due_date)
                                )}
                            </td>

                            ${isHistory ? `
                                <td>
                                    ${escapeHTML(
                                        readerFormatDate(item.return_date)
                                    )}
                                </td>
                            ` : ''}

                            <td>${readerLoanBadge(item)}</td>

                            <td>
                                <button class="btn-view"
                                    data-id="${Number(item.loan_item_id)}">
                                    Chi tiết
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function handleReaderLoanAction(event) {
    const button = event.target.closest('button[data-id]');

    if (!button) return;

    const item = readerLoanItems.find(
        item => Number(item.loan_item_id) === Number(button.dataset.id)
    );

    if (item) {
        viewReaderLoanItem(item);
    }
}

function viewReaderLoanItem(item) {
    const status = item.status === 'returned'
        ? 'Đã trả'
        : item.is_overdue
            ? 'Quá hạn'
            : 'Đang mượn';

    openModal(
        'Chi tiết sách mượn',
        `
            ${readerInfoRow('Mã phiếu', `#${item.loan_id}`)}
            ${readerInfoRow('Mã sách vật lý', item.copy_code)}
            ${readerInfoRow('Tên sách', item.title)}
            ${readerInfoRow('Tác giả', item.author)}

            ${readerInfoRow(
                'Thủ thư phê duyệt',
                item.approved_by_name || '—'
            )}

            ${readerInfoRow(
                'Ngày mượn',
                readerFormatDate(item.borrow_date)
            )}

            ${readerInfoRow(
                'Hạn trả',
                readerFormatDate(item.due_date)
            )}

            ${readerInfoRow(
                'Ngày trả thực tế',
                readerFormatDate(item.return_date)
            )}

            ${readerInfoRow('Trạng thái', status)}
        `,
        `
            <button class="btn-secondary"
                id="closeMyLoan">
                Đóng
            </button>
        `
    );

    document.getElementById('closeMyLoan')
        .addEventListener('click', closeModal);
}
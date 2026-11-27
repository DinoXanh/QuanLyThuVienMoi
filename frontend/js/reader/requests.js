let readerRequests = [];

const readerRequestLabels = {
    pending: 'Chờ duyệt',
    approved: 'Đã phê duyệt',
    rejected: 'Đã từ chối',
    cancelled: 'Đã hủy'
};

function readerFormatDate(value) {
    if (!value) return '—';

    return new Date(value).toLocaleString('vi-VN');
}

function readerRequestBadge(status) {
    const classes = {
        pending: 'status-warning',
        approved: 'status-success',
        rejected: 'status-danger',
        cancelled: ''
    };

    return `
        <span class="status-badge ${classes[status] || ''}">
            ${escapeHTML(readerRequestLabels[status] || status)}
        </span>
    `;
}

async function loadReaderRequests(version) {
    try {
        const requests = await apiRequest('/borrow-requests/my');

        if (version !== pageVersion) return;

        readerRequests = requests;

        pageContent.innerHTML = `
            <div class="stats-grid">

                ${readerStatCard(
                    'Chờ duyệt',
                    requests.filter(r => r.status === 'pending').length,
                    'warning'
                )}

                ${readerStatCard(
                    'Đã phê duyệt',
                    requests.filter(r => r.status === 'approved').length,
                    'success'
                )}

                ${readerStatCard(
                    'Đã từ chối',
                    requests.filter(r => r.status === 'rejected').length,
                    'danger'
                )}

                ${readerStatCard(
                    'Đã hủy',
                    requests.filter(r => r.status === 'cancelled').length
                )}

            </div>

            <div class="toolbar">

                <div class="toolbar-filters">

                    <input type="search"
                        id="myRequestSearch"
                        class="search-input"
                        placeholder="Tìm mã yêu cầu hoặc tên sách...">

                    <select id="myRequestFilter">
                        <option value="">Tất cả trạng thái</option>
                        <option value="pending">Chờ duyệt</option>
                        <option value="approved">Đã phê duyệt</option>
                        <option value="rejected">Đã từ chối</option>
                        <option value="cancelled">Đã hủy</option>
                    </select>

                </div>

                <button class="btn-secondary"
                    id="refreshMyRequests">
                    Làm mới
                </button>

            </div>

            <div id="myRequestTable"></div>
        `;

        document.getElementById('myRequestSearch')
            .addEventListener('input', renderReaderRequests);

        document.getElementById('myRequestFilter')
            .addEventListener('change', renderReaderRequests);

        document.getElementById('refreshMyRequests')
            .addEventListener('click', () => {
                navigateTo('requests');
            });

        document.getElementById('myRequestTable')
            .addEventListener('click', handleReaderRequestAction);

        renderReaderRequests();

    } catch (error) {
        if (version !== pageVersion) return;

        pageContent.innerHTML = `
            <div class="error-message">
                ${escapeHTML(error.message)}
            </div>
        `;
    }
}

function renderReaderRequests() {
    const table = document.getElementById('myRequestTable');

    if (!table) return;

    const search = document.getElementById('myRequestSearch')
        .value.trim().toLowerCase();

    const status = document.getElementById('myRequestFilter').value;

    const requests = readerRequests.filter(request => {
        const content = [
            request.id,
            ...(request.items || []).map(item => item.title)
        ].join(' ').toLowerCase();

        return content.includes(search) &&
            (!status || request.status === status);
    });

    if (!requests.length) {
        table.innerHTML = `
            <div class="panel empty-message">
                Không có yêu cầu mượn sách phù hợp.
            </div>
        `;
        return;
    }

    table.innerHTML = `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Mã yêu cầu</th>
                        <th>Danh sách sách</th>
                        <th>Số lượng</th>
                        <th>Ngày gửi</th>
                        <th>Trạng thái</th>
                        <th>Thao tác</th>
                    </tr>
                </thead>

                <tbody>
                    ${requests.map(request => `
                        <tr>
                            <td>#${Number(request.id)}</td>

                            <td>
                                ${(request.items || []).map(item =>
                                    escapeHTML(item.title)
                                ).join('<br>')}
                            </td>

                            <td>
                                ${(request.items || []).reduce(
                                    (sum, item) =>
                                        sum + Number(item.quantity),
                                    0
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    readerFormatDate(request.created_at)
                                )}
                            </td>

                            <td>
                                ${readerRequestBadge(request.status)}
                            </td>

                            <td>
                                <div class="action-group">

                                    <button class="btn-view"
                                        data-action="view"
                                        data-id="${Number(request.id)}">
                                        Chi tiết
                                    </button>

                                    ${request.status === 'pending' ? `
                                        <button class="btn-danger"
                                            data-action="cancel"
                                            data-id="${Number(request.id)}">
                                            Hủy yêu cầu
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

function handleReaderRequestAction(event) {
    const button = event.target.closest('button[data-action]');

    if (!button || button.disabled) return;

    const request = readerRequests.find(
        item => Number(item.id) === Number(button.dataset.id)
    );

    if (!request) return;

    if (button.dataset.action === 'view') {
        viewReaderRequest(request);
    }

    if (button.dataset.action === 'cancel') {
        cancelReaderRequest(request);
    }
}

function viewReaderRequest(request) {
    openModal(
        `Chi tiết yêu cầu #${request.id}`,
        `
            ${readerInfoRow(
                'Ngày gửi',
                readerFormatDate(request.created_at)
            )}

            ${readerInfoRow(
                'Trạng thái',
                readerRequestLabels[request.status]
            )}

            ${readerInfoRow(
                'Ngày xử lý',
                readerFormatDate(request.reviewed_at)
            )}

            ${request.rejection_reason ? `
                <div class="reader-alert">
                    <strong>Lý do từ chối:</strong>

                    <p>
                        ${escapeHTML(request.rejection_reason)}
                    </p>
                </div>
            ` : ''}

            <h3 class="request-books-title">
                Danh sách sách
            </h3>

            ${(request.items || []).map(item =>
                readerInfoRow(
                    item.title,
                    `${item.quantity} cuốn`
                )
            ).join('')}
        `,
        `
            <button class="btn-secondary"
                id="closeMyRequest">
                Đóng
            </button>
        `
    );

    document.getElementById('closeMyRequest')
        .addEventListener('click', closeModal);
}

async function cancelReaderRequest(request) {
    if (request.status !== 'pending') return;

    if (!confirm(
        `Bạn có muốn hủy yêu cầu #${request.id}?`
    )) return;

    const buttons = document.querySelectorAll(
        '#myRequestTable button'
    );

    buttons.forEach(button => button.disabled = true);

    try {
        const result = await apiRequest(
            `/borrow-requests/${request.id}/cancel`,
            { method: 'PATCH' }
        );

        alert(result.message || 'Đã hủy yêu cầu');

        if (currentPage === 'requests') {
            await navigateTo('requests');
        }

    } catch (error) {
        alert(error.message);

        if (currentPage === 'requests') {
            await navigateTo('requests');
        }

    } finally {
        buttons.forEach(button => button.disabled = false);
    }
}
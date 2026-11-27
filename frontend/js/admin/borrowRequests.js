let adminRequests = [];

const requestStatusLabels = {
    pending: 'Chờ duyệt',
    approved: 'Đã phê duyệt',
    rejected: 'Đã từ chối',
    cancelled: 'Đã hủy'
};

function requestStatusBadge(status) {
    const types = {
        pending: 'status-warning',
        approved: 'status-success',
        rejected: 'status-danger',
        cancelled: ''
    };

    return `
        <span class="status-badge ${types[status] || ''}">
            ${escapeHTML(requestStatusLabels[status] || status)}
        </span>
    `;
}

function formatRequestDate(value) {
    if (!value) return 'Chưa cập nhật';

    return new Date(value).toLocaleString('vi-VN');
}

async function loadBorrowRequests(version) {
    try {
        const requests = await apiRequest('/borrow-requests');

        if (version !== pageVersion) return;

        adminRequests = requests;

        pageContent.innerHTML = `
            <div class="stats-grid">

                ${statCard(
                    'Chờ duyệt',
                    requests.filter(r => r.status === 'pending').length,
                    'warning'
                )}

                ${statCard(
                    'Đã phê duyệt',
                    requests.filter(r => r.status === 'approved').length,
                    'success'
                )}

                ${statCard(
                    'Đã từ chối',
                    requests.filter(r => r.status === 'rejected').length,
                    'danger'
                )}

                ${statCard(
                    'Đã hủy',
                    requests.filter(r => r.status === 'cancelled').length
                )}

            </div>

            <div class="toolbar">
                <div class="toolbar-filters">

                    <input type="search"
                        id="requestSearch"
                        class="search-input"
                        placeholder="Tìm tên độc giả hoặc MSSV...">

                    <select id="requestStatusFilter">
                        <option value="">Tất cả trạng thái</option>
                        <option value="pending">Chờ duyệt</option>
                        <option value="approved">Đã phê duyệt</option>
                        <option value="rejected">Đã từ chối</option>
                        <option value="cancelled">Đã hủy</option>
                    </select>

                </div>

                <button class="btn-secondary"
                    id="refreshRequests">
                    Làm mới
                </button>
            </div>

            <div id="requestTable"></div>
        `;

        document.getElementById('requestSearch')
            .addEventListener('input', renderRequestTable);

        document.getElementById('requestStatusFilter')
            .addEventListener('change', renderRequestTable);

        document.getElementById('refreshRequests')
            .addEventListener('click', () => {
                navigateTo('requests');
            });

        document.getElementById('requestTable')
            .addEventListener('click', handleRequestAction);

        renderRequestTable();

    } catch (error) {
        if (version !== pageVersion) return;

        pageContent.innerHTML = `
            <div class="error-message">
                ${escapeHTML(error.message)}
            </div>
        `;
    }
}

function renderRequestTable() {
    const table = document.getElementById('requestTable');

    if (!table) return;

    const search = document.getElementById('requestSearch')
        .value.trim().toLowerCase();

    const status = document.getElementById('requestStatusFilter').value;

    const requests = adminRequests.filter(request => {
        const name = String(request.full_name || '').toLowerCase();
        const mssv = String(request.mssv || '').toLowerCase();

        const matchSearch =
            name.includes(search) || mssv.includes(search);

        const matchStatus =
            !status || request.status === status;

        return matchSearch && matchStatus;
    });

    if (!requests.length) {
        table.innerHTML = `
            <div class="panel empty-message">
                Không tìm thấy yêu cầu mượn sách.
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
                        <th>Độc giả</th>
                        <th>MSSV</th>
                        <th>Số lượng sách</th>
                        <th>Ngày gửi</th>
                        <th>Trạng thái</th>
                        <th>Thao tác</th>
                    </tr>
                </thead>

                <tbody>
                    ${requests.map(request => {
                        const quantity = (request.items || [])
                            .reduce(
                                (sum, item) => sum + Number(item.quantity),
                                0
                            );

                        return `
                            <tr>
                                <td>#${Number(request.id)}</td>

                                <td>
                                    ${escapeHTML(request.full_name)}
                                </td>

                                <td>
                                    ${escapeHTML(request.mssv || '')}
                                </td>

                                <td>${quantity}</td>

                                <td>
                                    ${escapeHTML(formatRequestDate(request.created_at))}
                                </td>

                                <td>
                                    ${requestStatusBadge(request.status)}
                                </td>

                                <td>
                                    <div class="action-group">

                                        <button class="btn-view"
                                            data-action="view"
                                            data-id="${Number(request.id)}">
                                            Xem
                                        </button>

                                        ${request.status === 'pending' ? `
                                            <button class="btn-primary"
                                                data-action="approve"
                                                data-id="${Number(request.id)}">
                                                Duyệt
                                            </button>

                                            <button class="btn-danger"
                                                data-action="reject"
                                                data-id="${Number(request.id)}">
                                                Từ chối
                                            </button>
                                        ` : ''}

                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function handleRequestAction(event) {
    const button = event.target.closest('button[data-action]');

    if (!button || button.disabled) return;

    const id = Number(button.dataset.id);

    const request = adminRequests.find(
        item => Number(item.id) === id
    );

    if (!request) return;

    switch (button.dataset.action) {
        case 'view':
            viewBorrowRequest(request);
            break;

        case 'approve':
            approveBorrowRequest(request);
            break;

        case 'reject':
            openRejectRequestForm(request);
            break;
    }
}

function requestDetailRow(label, value) {
    return `
        <div class="detail-row">
            <strong>${escapeHTML(label)}</strong>
            <span>${escapeHTML(value)}</span>
        </div>
    `;
}

function viewBorrowRequest(request) {
    openModal(
        `Chi tiết yêu cầu #${request.id}`,
        `
            ${requestDetailRow('Họ và tên', request.full_name)}
            ${requestDetailRow('MSSV', request.mssv || 'Chưa cập nhật')}
            ${requestDetailRow('Lớp', request.class_name || 'Chưa cập nhật')}

            ${requestDetailRow(
                'Ngày gửi yêu cầu',
                formatRequestDate(request.created_at)
            )}

            ${requestDetailRow(
                'Trạng thái',
                requestStatusLabels[request.status]
            )}

            ${request.reviewed_at ? requestDetailRow(
                'Ngày xử lý',
                formatRequestDate(request.reviewed_at)
            ) : ''}

            ${request.rejection_reason ? requestDetailRow(
                'Lý do từ chối',
                request.rejection_reason
            ) : ''}

            <h3 class="request-books-title">
                Danh sách sách yêu cầu
            </h3>

            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Tên sách</th>
                            <th>Tác giả</th>
                            <th>Số lượng</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${(request.items || []).map(item => `
                            <tr>
                                <td>${escapeHTML(item.title)}</td>
                                <td>${escapeHTML(item.author)}</td>
                                <td>${Number(item.quantity)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `,
        `
            <button class="btn-secondary"
                id="closeRequestDetail">
                Đóng
            </button>
        `
    );

    document.getElementById('closeRequestDetail')
        .addEventListener('click', closeModal);
}

async function approveBorrowRequest(request) {
    if (request.status !== 'pending') return;

    const confirmed = confirm(
        `Phê duyệt yêu cầu #${request.id} của ${request.full_name}?`
    );

    if (!confirmed) return;

    const table = document.getElementById('requestTable');
    const buttons = table.querySelectorAll('button');

    buttons.forEach(button => {
        button.disabled = true;
    });

    try {
        const result = await apiRequest(
            `/borrow-requests/${request.id}/approve`,
            {
                method: 'PATCH'
            }
        );

        alert(result.message || 'Phê duyệt thành công');

        if (currentPage === 'requests') {
            await navigateTo('requests');
        }

    } catch (error) {
        alert(error.message);

        if (currentPage === 'requests') {
            await navigateTo('requests');
        }

    } finally {
        buttons.forEach(button => {
            button.disabled = false;
        });
    }
}

function openRejectRequestForm(request) {
    if (request.status !== 'pending') return;

    openModal(
        `Từ chối yêu cầu #${request.id}`,
        `
            ${requestDetailRow('Độc giả', request.full_name)}
            ${requestDetailRow('MSSV', request.mssv)}

            <form id="rejectRequestForm">

                <div class="form-group">
                    <label for="rejectionReason">
                        Lý do từ chối *
                    </label>

                    <textarea id="rejectionReason"
                        placeholder="Nhập lý do từ chối yêu cầu..."
                        required></textarea>
                </div>

                <p class="form-message"
                    id="rejectRequestMessage"
                    role="alert"></p>

            </form>
        `,
        `
            <button class="btn-secondary"
                id="cancelRejectRequest">
                Hủy
            </button>

            <button type="submit"
                form="rejectRequestForm"
                class="btn-danger"
                id="confirmRejectRequest">
                Xác nhận từ chối
            </button>
        `
    );

    document.getElementById('cancelRejectRequest')
        .addEventListener('click', closeModal);

    document.getElementById('rejectRequestForm')
        .addEventListener('submit', event => {
            rejectBorrowRequest(event, request.id);
        });
}

async function rejectBorrowRequest(event, id) {
    event.preventDefault();

    const reason = document.getElementById('rejectionReason')
        .value.trim();

    const message = document.getElementById('rejectRequestMessage');
    const button = document.getElementById('confirmRejectRequest');
    const modal = document.getElementById('modalOverlay');

    if (!reason) {
        message.textContent = 'Vui lòng nhập lý do từ chối.';
        return;
    }

    button.disabled = true;
    button.textContent = 'Đang xử lý...';
    message.textContent = '';

    try {
        const result = await apiRequest(
            `/borrow-requests/${id}/reject`,
            {
                method: 'PATCH',
                body: JSON.stringify({
                    rejection_reason: reason
                })
            }
        );

        if (modal.isConnected) {
            closeModal();
        }

        alert(result.message || 'Đã từ chối yêu cầu');

        if (currentPage === 'requests') {
            await navigateTo('requests');
        }

    } catch (error) {
        message.textContent = error.message;

    } finally {
        button.disabled = false;
        button.textContent = 'Xác nhận từ chối';
    }
}
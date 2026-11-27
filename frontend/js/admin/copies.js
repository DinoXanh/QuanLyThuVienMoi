let adminCopies = [];
let copyBooks = [];
let copyCapacity = {};

async function loadCopies(version) {
    try {
        const [copies, books, capacity] = await Promise.all([
            apiRequest('/copies'),
            apiRequest('/books'),
            apiRequest('/copies/capacity')
        ]);

        if (version !== pageVersion) return;

        adminCopies = copies;
        copyBooks = books;
        copyCapacity = capacity;

        const total = Number(capacity.total_copies);
        const maximum = Number(capacity.max_capacity);
        const remaining = Number(capacity.remaining_capacity);

        const percentage = maximum > 0
            ? Math.min(100, total / maximum * 100)
            : 0;

        pageContent.innerHTML = `
            <div class="stats-grid">
                ${statCard('Tổng sách vật lý', total)}
                ${statCard('Sức chứa tối đa', maximum)}
                ${statCard('Có thể thêm', remaining, 'success')}
                ${statCard(
                    'Đang được mượn',
                    copies.filter(copy => copy.status === 'on_loan').length
                )}
            </div>

            <section class="panel">
                <h3>Sức chứa thư viện</h3>

                <div class="capacity-info">
                    <span>${total} / ${maximum} cuốn</span>
                    <strong>${percentage}%</strong>
                </div>

                <div class="progress-bar">
                    <div class="progress-fill"
                        style="width: ${percentage}%">
                    </div>
                </div>

                <p class="capacity-note">
                    Có thể thêm ${remaining} cuốn sách.
                </p>
            </section>

            <div class="toolbar">
                <div class="toolbar-filters">

                    <input type="search"
                        id="copySearch"
                        class="search-input"
                        placeholder="Tìm tên sách hoặc mã sách...">

                    <select id="copyBookFilter">
                        <option value="">Tất cả đầu sách</option>

                        ${copyBooks.map(book => `
                            <option value="${Number(book.id)}">
                                ${escapeHTML(book.title)}
                            </option>
                        `).join('')}
                    </select>

                    <select id="copyStatusFilter">
                        <option value="">Tất cả trạng thái</option>
                        <option value="available">Có sẵn</option>
                        <option value="on_loan">Đang mượn</option>
                    </select>

                </div>

                <button class="btn-primary"
                    id="addCopyButton"
                    ${remaining <= 0 || !books.length ? 'disabled' : ''}>
                    Thêm bản sao
                </button>
            </div>

            <div id="copyTable"></div>
        `;

        document.getElementById('copySearch')
            .addEventListener('input', renderCopyTable);

        document.getElementById('copyBookFilter')
            .addEventListener('change', renderCopyTable);

        document.getElementById('copyStatusFilter')
            .addEventListener('change', renderCopyTable);

        document.getElementById('addCopyButton')
            .addEventListener('click', openCopyForm);

        document.getElementById('copyTable')
            .addEventListener('click', handleCopyAction);

        renderCopyTable();

    } catch (error) {
        if (version !== pageVersion) return;

        pageContent.innerHTML = `
            <div class="error-message">
                ${escapeHTML(error.message)}
            </div>
        `;
    }
}

function getCopyBook(copy) {
    return copyBooks.find(
        book => Number(book.id) === Number(copy.book_id)
    );
}

function renderCopyTable() {
    const table = document.getElementById('copyTable');

    if (!table) return;

    const search = document.getElementById('copySearch')
        .value.trim().toLowerCase();

    const bookId = document.getElementById('copyBookFilter').value;
    const status = document.getElementById('copyStatusFilter').value;

    const copies = adminCopies.filter(copy => {
        const book = getCopyBook(copy);

        const title = String(book?.title || '').toLowerCase();
        const code = String(copy.copy_code || '').toLowerCase();

        const matchSearch =
            title.includes(search) || code.includes(search);

        const matchBook =
            !bookId || Number(copy.book_id) === Number(bookId);

        const matchStatus =
            !status || copy.status === status;

        return matchSearch && matchBook && matchStatus;
    });

    if (!copies.length) {
        table.innerHTML = `
            <div class="panel empty-message">
                Không tìm thấy bản sao sách.
            </div>
        `;
        return;
    }

    table.innerHTML = `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Mã sách</th>
                        <th>Tên sách</th>
                        <th>Tác giả</th>
                        <th>Trạng thái</th>
                        <th>Thao tác</th>
                    </tr>
                </thead>

                <tbody>
                    ${copies.map(copy => {
                        const book = getCopyBook(copy);
                        const available = copy.status === 'available';

                        return `
                            <tr>
                                <td>${Number(copy.id)}</td>

                                <td>
                                    <strong>
                                        ${escapeHTML(copy.copy_code)}
                                    </strong>
                                </td>

                                <td>
                                    ${escapeHTML(book?.title || 'Không xác định')}
                                </td>

                                <td>
                                    ${escapeHTML(book?.author || '')}
                                </td>

                                <td>
                                    <span class="status-badge
                                        ${available ? 'status-success' : 'status-warning'}">

                                        ${available ? 'Có sẵn' : 'Đang mượn'}

                                    </span>
                                </td>

                                <td>
                                    <button class="btn-danger"
                                        data-action="delete"
                                        data-id="${Number(copy.id)}"
                                        ${available ? '' : 'disabled'}>
                                        Xóa
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function openCopyForm() {
    if (Number(copyCapacity.remaining_capacity) <= 0) {
        alert('Thư viện đã đạt sức chứa tối đa.');
        return;
    }

    openModal(
        'Thêm bản sao sách',
        `
            <form id="copyForm">

                <div class="form-group">
                    <label for="copyBook">
                        Đầu sách *
                    </label>

                    <select id="copyBook" required>
                        <option value="">Chọn đầu sách</option>

                        ${copyBooks.map(book => `
                            <option value="${Number(book.id)}">
                                ${escapeHTML(book.title)}
                            </option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label for="copyCode">
                        Mã sách *
                    </label>

                    <input id="copyCode"
                        maxlength="30"
                        placeholder="Ví dụ: JAVA005"
                        required>
                </div>

                <p class="capacity-note">
                    Mỗi cuốn sách phải có một mã riêng,
                    không được trùng với cuốn khác.
                </p>

                <p class="capacity-note">
                    Số lượng có thể thêm:
                    ${Number(copyCapacity.remaining_capacity)} cuốn.
                </p>

                <p class="form-message"
                    id="copyFormMessage"
                    role="alert"></p>

            </form>
        `,
        `
            <button class="btn-secondary"
                id="cancelCopyButton">
                Hủy
            </button>

            <button type="submit"
                form="copyForm"
                class="btn-primary"
                id="saveCopyButton">
                Thêm bản sao
            </button>
        `
    );

    document.getElementById('cancelCopyButton')
        .addEventListener('click', closeModal);

    document.getElementById('copyCode')
        .addEventListener('input', event => {
            event.target.value = event.target.value.toUpperCase();
        });

    document.getElementById('copyForm')
        .addEventListener('submit', saveCopy);
}

async function saveCopy(event) {
    event.preventDefault();

    const button = document.getElementById('saveCopyButton');
    const message = document.getElementById('copyFormMessage');
    const modal = document.getElementById('modalOverlay');

    const data = {
        book_id: Number(document.getElementById('copyBook').value),
        copy_code: document.getElementById('copyCode')
            .value.trim().toUpperCase()
    };

    if (!data.book_id || !data.copy_code) {
        message.textContent = 'Vui lòng nhập đầy đủ thông tin.';
        return;
    }

    button.disabled = true;
    button.textContent = 'Đang lưu...';
    message.textContent = '';

    try {
        const result = await apiRequest('/copies', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        if (modal.isConnected) {
            closeModal();
        }

        alert(result.message || 'Thêm bản sao thành công');

        if (currentPage === 'copies') {
            await navigateTo('copies');
        }

    } catch (error) {
        message.textContent = error.message;

    } finally {
        button.disabled = false;
        button.textContent = 'Thêm bản sao';
    }
}

function handleCopyAction(event) {
    const button = event.target.closest('button[data-action]');

    if (!button || button.disabled) return;

    const id = Number(button.dataset.id);

    const copy = adminCopies.find(
        item => Number(item.id) === id
    );

    if (!copy) return;

    if (button.dataset.action === 'delete') {
        deleteCopy(copy);
    }
}

async function deleteCopy(copy) {
    if (copy.status !== 'available') {
        alert('Không thể xóa sách đang được mượn.');
        return;
    }

    if (!confirm(`Bạn có chắc muốn xóa cuốn sách "${copy.copy_code}"?`)) {
        return;
    }

    try {
        const result = await apiRequest(`/copies/${copy.id}`, {
            method: 'DELETE'
        });

        alert(result.message || 'Xóa bản sao thành công');

        if (currentPage === 'copies') {
            await navigateTo('copies');
        }

    } catch (error) {
        alert(error.message);
    }
}
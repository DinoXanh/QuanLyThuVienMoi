let adminBooks = [];
let adminBookCategories = [];
let bookSearchVersion = 0;

async function loadBooks(version) {
    try {
        adminBookCategories = await apiRequest('/categories');

        if (version !== pageVersion) return;

        pageContent.innerHTML = `
            <div class="toolbar">

                <div class="toolbar-filters">
                    <input type="search"
                        id="bookSearch"
                        class="search-input"
                        placeholder="Tìm tên sách hoặc tác giả...">

                    <select id="bookCategory">
                        <option value="">Tất cả danh mục</option>

                        ${adminBookCategories.map(category => `
                            <option value="${Number(category.id)}">
                                ${escapeHTML(category.name)}
                            </option>
                        `).join('')}
                    </select>

                    <button class="btn-secondary" id="bookSearchButton">
                        Tìm kiếm
                    </button>
                </div>

                <button class="btn-primary" id="addBookButton">
                    Thêm sách
                </button>

            </div>

            <div id="bookTable"></div>
        `;

        document.getElementById('bookSearchButton')
            .addEventListener('click', fetchBooks);

        document.getElementById('bookSearch')
            .addEventListener('keydown', event => {
                if (event.key === 'Enter') {
                    fetchBooks();
                }
            });

        document.getElementById('bookCategory')
            .addEventListener('change', fetchBooks);

        document.getElementById('addBookButton')
            .addEventListener('click', () => openBookForm());

        document.getElementById('bookTable')
            .addEventListener('click', handleBookAction);

        await fetchBooks();

    } catch (error) {
        if (version !== pageVersion) return;

        pageContent.innerHTML = `
            <div class="error-message">
                ${escapeHTML(error.message)}
            </div>
        `;
    }
}

async function fetchBooks() {
    const table = document.getElementById('bookTable');

    if (!table) return;

    const version = ++bookSearchVersion;

    const search = document.getElementById('bookSearch').value.trim();
    const category = document.getElementById('bookCategory').value;

    const params = new URLSearchParams();

    if (search) {
        params.set('search', search);
    }

    if (category) {
        params.set('category_id', category);
    }

    table.innerHTML = `
        <div class="loading-message">
            Đang tải danh sách sách...
        </div>
    `;

    try {
        const data = await apiRequest(`/books?${params.toString()}`);

        if (version !== bookSearchVersion || !table.isConnected) {
            return;
        }

        adminBooks = data;
        renderBookTable();

    } catch (error) {
        if (version !== bookSearchVersion || !table.isConnected) {
            return;
        }

        table.innerHTML = `
            <div class="error-message">
                ${escapeHTML(error.message)}
            </div>
        `;
    }
}

function renderBookTable() {
    const table = document.getElementById('bookTable');

    if (!table) return;

    if (!adminBooks.length) {
        table.innerHTML = `
            <div class="panel empty-message">
                Không tìm thấy sách.
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
                        <th>Tên sách</th>
                        <th>Tác giả</th>
                        <th>Danh mục</th>
                        <th>Tổng số</th>
                        <th>Có sẵn</th>
                        <th>Đang mượn</th>
                        <th>Thao tác</th>
                    </tr>
                </thead>

                <tbody>
                    ${adminBooks.map(book => `
                        <tr>
                            <td>${Number(book.id)}</td>

                            <td>
                                <strong>${escapeHTML(book.title)}</strong>
                            </td>

                            <td>${escapeHTML(book.author)}</td>

                            <td>
                                ${escapeHTML(book.category_name || 'Chưa phân loại')}
                            </td>

                            <td>${Number(book.total_copies)}</td>

                            <td>
                                <span class="status-badge ${
                                    Number(book.available_copies) > 0
                                        ? 'status-success'
                                        : 'status-danger'
                                }">
                                    ${Number(book.available_copies)}
                                </span>
                            </td>

                            <td>${Number(book.borrowed_copies)}</td>

                            <td>
                                <div class="action-group">
                                    <button class="btn-view"
                                        data-action="view"
                                        data-id="${Number(book.id)}">
                                        Xem
                                    </button>

                                    <button class="btn-edit"
                                        data-action="edit"
                                        data-id="${Number(book.id)}">
                                        Sửa
                                    </button>

                                    <button class="btn-danger"
                                        data-action="delete"
                                        data-id="${Number(book.id)}">
                                        Xóa
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>

            </table>
        </div>
    `;
}

function handleBookAction(event) {
    const button = event.target.closest('button[data-action]');

    if (!button) return;

    const id = Number(button.dataset.id);
    const action = button.dataset.action;

    if (action === 'view') {
        viewBook(id);
    }

    if (action === 'edit') {
        editBook(id);
    }

    if (action === 'delete') {
        deleteBook(id);
    }
}

function bookDetailRow(label, value) {
    return `
        <div class="detail-row">
            <span>${escapeHTML(label)}</span>
            <strong>${escapeHTML(value ?? 'Chưa cập nhật')}</strong>
        </div>
    `;
}

async function viewBook(id) {
    const version = pageVersion;

    try {
        const book = await apiRequest(`/books/${id}`);

        if (version !== pageVersion) return;

        openModal('Thông tin sách', `
            <div id="bookCoverContainer"></div>

            ${bookDetailRow('Mã đầu sách', book.id)}
            ${bookDetailRow('Tên sách', book.title)}
            ${bookDetailRow('Tác giả', book.author)}
            ${bookDetailRow('Danh mục', book.category_name)}
            ${bookDetailRow('Nhà xuất bản', book.publisher)}
            ${bookDetailRow('Năm xuất bản', book.publication_year)}
            ${bookDetailRow('Tổng số cuốn', book.total_copies)}
            ${bookDetailRow('Có sẵn', book.available_copies)}
            ${bookDetailRow('Đang mượn', book.borrowed_copies)}
            ${bookDetailRow('Mô tả', book.description)}

        `, `
            <button class="btn-secondary" id="closeBookDetail">
                Đóng
            </button>
        `);

        document.getElementById('closeBookDetail')
            .addEventListener('click', closeModal);

        if (book.cover_url) {
            const url = new URL(book.cover_url, window.location.href);

            if (['http:', 'https:'].includes(url.protocol)) {
                const image = document.createElement('img');

                image.src = url.href;
                image.alt = book.title;
                image.className = 'book-cover';

                image.addEventListener('error', () => image.remove());

                document.getElementById('bookCoverContainer')
                    .appendChild(image);
            }
        }

    } catch (error) {
        alert(error.message);
    }
}

async function editBook(id) {
    const version = pageVersion;

    try {
        const book = await apiRequest(`/books/${id}`);

        if (version !== pageVersion) return;

        openBookForm(book);

    } catch (error) {
        alert(error.message);
    }
}

function openBookForm(book = null) {
    const editing = Boolean(book);

    openModal(editing ? 'Chỉnh sửa sách' : 'Thêm sách mới', `
        <form id="bookForm">

            <div class="form-grid">

                <div class="form-group full-width">
                    <label for="bookTitle">Tên sách *</label>

                    <input id="bookTitle"
                        maxlength="255"
                        value="${escapeHTML(book?.title)}"
                        required>
                </div>

                <div class="form-group">
                    <label for="bookAuthor">Tác giả *</label>

                    <input id="bookAuthor"
                        maxlength="150"
                        value="${escapeHTML(book?.author)}"
                        required>
                </div>

                <div class="form-group">
                    <label for="bookFormCategory">Danh mục</label>

                    <select id="bookFormCategory">
                        <option value="">Chưa phân loại</option>

                        ${adminBookCategories.map(category => `
                            <option value="${Number(category.id)}"
                                ${Number(book?.category_id) ===
                                    Number(category.id) ? 'selected' : ''}>
                                ${escapeHTML(category.name)}
                            </option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label for="bookPublisher">Nhà xuất bản</label>

                    <input id="bookPublisher"
                        maxlength="150"
                        value="${escapeHTML(book?.publisher)}">
                </div>

                <div class="form-group">
                    <label for="bookYear">Năm xuất bản</label>

                    <input type="number"
                        id="bookYear"
                        min="1"
                        max="${new Date().getFullYear()}"
                        value="${escapeHTML(book?.publication_year)}">
                </div>

                <div class="form-group full-width">
                    <label for="bookCover">Đường dẫn ảnh bìa</label>

                    <input id="bookCover"
                        placeholder="images/book.jpg"
                        value="${escapeHTML(book?.cover_url)}">
                </div>

                <div class="form-group full-width">
                    <label for="bookDescription">Mô tả sách</label>

                    <textarea id="bookDescription">${escapeHTML(book?.description)}</textarea>
                </div>

            </div>

            <p class="form-message" id="bookFormMessage"
                role="alert"></p>

        </form>

    `, `
        <button type="button" class="btn-secondary" id="cancelBookForm">
            Hủy
        </button>

        <button type="submit"
            form="bookForm"
            class="btn-primary"
            id="saveBookButton">
            ${editing ? 'Lưu thay đổi' : 'Thêm sách'}
        </button>
    `);

    document.getElementById('cancelBookForm')
        .addEventListener('click', closeModal);

    document.getElementById('bookForm')
        .addEventListener('submit', event => {
            saveBook(event, book?.id);
        });
}

async function saveBook(event, id) {
    event.preventDefault();

    const button = document.getElementById('saveBookButton');
    const message = document.getElementById('bookFormMessage');
    const modal = document.getElementById('modalOverlay');

    const category = document.getElementById('bookFormCategory').value;
    const year = document.getElementById('bookYear').value;

    const data = {
        title: document.getElementById('bookTitle').value.trim(),
        author: document.getElementById('bookAuthor').value.trim(),
        category_id: category ? Number(category) : null,
        publisher: document.getElementById('bookPublisher').value.trim(),
        publication_year: year ? Number(year) : null,
        cover_url: document.getElementById('bookCover').value.trim(),
        description: document.getElementById('bookDescription').value.trim()
    };

    if (!data.title || !data.author) {
        message.textContent = 'Vui lòng nhập tên sách và tác giả.';
        return;
    }

    button.disabled = true;
    button.textContent = 'Đang lưu...';
    message.textContent = '';

    try {
        const result = await apiRequest(
            id ? `/books/${id}` : '/books',
            {
                method: id ? 'PUT' : 'POST',
                body: JSON.stringify(data)
            }
        );

        if (modal.isConnected) {
            closeModal();
        }

        alert(result.message || 'Lưu sách thành công');

        if (currentPage === 'books') {
            await fetchBooks();
        }

    } catch (error) {
        message.textContent = error.message;

    } finally {
        button.disabled = false;
        button.textContent = id ? 'Lưu thay đổi' : 'Thêm sách';
    }
}

async function deleteBook(id) {
    const book = adminBooks.find(item => Number(item.id) === id);

    if (!book) return;

    if (!confirm(`Bạn có chắc muốn xóa sách "${book.title}"?`)) {
        return;
    }

    try {
        const result = await apiRequest(`/books/${id}`, {
            method: 'DELETE'
        });

        alert(result.message || 'Xóa sách thành công');

        if (currentPage === 'books') {
            await fetchBooks();
        }

    } catch (error) {
        alert(error.message);
    }
}
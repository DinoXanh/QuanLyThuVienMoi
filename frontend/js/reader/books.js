let readerBooks = [];
let readerBookSearchVersion = 0;
let borrowCart = [];

async function loadReaderBooks(version) {
    try {
        const categories = await apiRequest('/categories');

        if (version !== pageVersion) return;

        pageContent.innerHTML = `
            <div class="toolbar">

                <div class="toolbar-filters">

                    <input type="search"
                        id="readerBookSearch"
                        class="search-input"
                        placeholder="Nhập tên sách hoặc tác giả...">

                    <select id="readerCategoryFilter">

                        <option value="">Tất cả danh mục</option>

                        ${categories.map(category => `
                            <option value="${Number(category.id)}">
                                ${escapeHTML(category.name)}
                            </option>
                        `).join('')}

                    </select>

                    <button class="btn-primary"
                        id="readerSearchButton">
                        Tìm kiếm
                    </button>

                </div>

                <button class="btn-secondary"
                    id="openBorrowCart">
                    Xem phiếu mượn
                </button>

            </div>

            <p class="book-result-count"
                id="readerBookCount"></p>

            <div id="readerBookGrid"
                class="reader-book-grid"></div>
        `;

        document.getElementById('readerSearchButton')
            .addEventListener('click', fetchReaderBooks);

        document.getElementById('readerBookSearch')
            .addEventListener('keydown', event => {
                if (event.key === 'Enter') {
                    fetchReaderBooks();
                }
            });

        document.getElementById('readerCategoryFilter')
            .addEventListener('change', fetchReaderBooks);

        document.getElementById('openBorrowCart')
            .addEventListener('click', () => {
                navigateTo('borrowCart');
            });

        document.getElementById('readerBookGrid')
            .addEventListener('click', handleReaderBookAction);

        await fetchReaderBooks();

    } catch (error) {
        if (version !== pageVersion) return;

        pageContent.innerHTML = `
            <div class="error-message">
                ${escapeHTML(error.message)}
            </div>
        `;
    }
}

async function fetchReaderBooks() {
    const grid = document.getElementById('readerBookGrid');

    if (!grid) return;

    const version = ++readerBookSearchVersion;

    const search = document.getElementById('readerBookSearch')
        .value.trim();

    const category = document
        .getElementById('readerCategoryFilter').value;

    const params = new URLSearchParams();

    if (search) {
        params.set('search', search);
    }

    if (category) {
        params.set('category_id', category);
    }

    grid.innerHTML = `
        <div class="loading-message">
            Đang tải danh sách sách...
        </div>
    `;

    try {
        const books = await apiRequest(
            `/books?${params.toString()}`
        );

        if (
            version !== readerBookSearchVersion ||
            !grid.isConnected
        ) return;

        readerBooks = books;

        document.getElementById('readerBookCount')
            .textContent = `Tìm thấy ${books.length} đầu sách`;

        renderReaderBookGrid(grid, books);

    } catch (error) {
        if (
            version !== readerBookSearchVersion ||
            !grid.isConnected
        ) return;

        grid.innerHTML = `
            <div class="error-message">
                ${escapeHTML(error.message)}
            </div>
        `;
    }
}

function getSafeCoverURL(value) {
    if (!value) return '';

    try {
        const url = new URL(value, window.location.href);

        if (['http:', 'https:'].includes(url.protocol)) {
            return url.href;
        }

    } catch {
        return '';
    }

    return '';
}

function readerBookCard(book, showSimilarity = false) {
    const available = Number(book.available_copies || 0);
    const cover = getSafeCoverURL(book.cover_url);

    return `
        <article class="reader-book-card">

            <div class="reader-book-cover">

                <span class="book-cover-placeholder">
                    ${escapeHTML(book.title)}
                </span>

                ${cover ? `
                    <img src="${escapeHTML(cover)}"
                        alt="${escapeHTML(book.title)}"
                        loading="lazy">
                ` : ''}

            </div>

            <div class="reader-book-body">

                <span class="book-category-label">
                    ${escapeHTML(
                        book.category_name || 'Chưa phân loại'
                    )}
                </span>

                <h3>${escapeHTML(book.title)}</h3>

                <p class="reader-book-author">
                    ${escapeHTML(book.author)}
                </p>

                ${showSimilarity ? `
                    <div class="ai-similarity">
                        Điểm tương đồng:
                        ${Number(book.similarity).toFixed(3)}
                    </div>
                ` : ''}

                <div class="reader-book-stock">

                    <span class="status-badge
                        ${available > 0
                            ? 'status-success'
                            : 'status-danger'}">

                        ${available > 0
                            ? `Có sẵn: ${available} cuốn`
                            : 'Hết sách'}

                    </span>

                </div>

                <div class="reader-book-actions">

                    <button class="btn-view"
                        data-action="view"
                        data-id="${Number(book.id)}">
                        Chi tiết
                    </button>

                    <button class="btn-primary"
                        data-action="borrow"
                        data-id="${Number(book.id)}"
                        ${available <= 0 ? 'disabled' : ''}>
                        Chọn mượn
                    </button>

                </div>

            </div>

        </article>
    `;
}

function renderReaderBookGrid(grid, books, showSimilarity = false) {
    if (!books.length) {
        grid.innerHTML = `
            <div class="panel empty-message book-grid-empty">
                Không tìm thấy sách phù hợp.
            </div>
        `;
        return;
    }

    grid.innerHTML = books.map(book =>
        readerBookCard(book, showSimilarity)
    ).join('');

    grid.querySelectorAll('img').forEach(img => {
        const removeImage = () => img.remove();

        img.addEventListener('error', removeImage);

        if (img.complete && img.naturalWidth === 0) {
            removeImage();
        }
    });
}

function handleReaderBookAction(event) {
    const button = event.target.closest('button[data-action]');

    if (!button || button.disabled) return;

    const id = Number(button.dataset.id);

    switch (button.dataset.action) {
        case 'view':
            viewReaderBook(id);
            break;

        case 'borrow':
            addBookToCart(id, button);
            break;
    }
}

async function viewReaderBook(id) {
    const version = pageVersion;

    try {
        const book = await apiRequest(`/books/${id}`);

        if (version !== pageVersion) return;

        const available = Number(book.available_copies || 0);
        const cover = getSafeCoverURL(book.cover_url);

        openModal(
            'Thông tin sách',
            `
                <div class="reader-detail-cover"
                    id="readerDetailCover"></div>

                ${readerInfoRow('Tên sách', book.title)}
                ${readerInfoRow('Tác giả', book.author)}

                ${readerInfoRow(
                    'Danh mục',
                    book.category_name || 'Chưa phân loại'
                )}

                ${readerInfoRow(
                    'Nhà xuất bản',
                    book.publisher || '—'
                )}

                ${readerInfoRow(
                    'Năm xuất bản',
                    book.publication_year || '—'
                )}

                ${readerInfoRow(
                    'Tổng số bản sao',
                    book.total_copies
                )}

                ${readerInfoRow(
                    'Số sách có sẵn',
                    available
                )}

                <div class="reader-book-description">
                    <h3>Mô tả sách</h3>

                    <p>
                        ${escapeHTML(
                            book.description || 'Chưa có mô tả.'
                        )}
                    </p>
                </div>
            `,
            `
                <button class="btn-secondary"
                    id="closeReaderBook">
                    Đóng
                </button>

                <button class="btn-primary"
                    id="borrowDetailBook"
                    ${available <= 0 ? 'disabled' : ''}>
                    Chọn mượn
                </button>
            `
        );

        if (cover) {
            const img = document.createElement('img');

            img.src = cover;
            img.alt = book.title;
            img.className = 'book-cover';

            img.addEventListener('error', () => img.remove());

            document.getElementById('readerDetailCover')
                .appendChild(img);
        }

        document.getElementById('closeReaderBook')
            .addEventListener('click', closeModal);

        document.getElementById('borrowDetailBook')
            .addEventListener('click', event => {
                addBookToCart(id, event.currentTarget);
            });

    } catch (error) {
        alert(error.message);
    }
}

function getCartQuantity() {
    return borrowCart.reduce(
        (sum, item) => sum + item.quantity,
        0
    );
}

function updateCartCount() {
    document.getElementById('cartCount')
        .textContent = getCartQuantity();
}

async function addBookToCart(id, button) {
    if (cartSubmitting) return;
    if (button) button.disabled = true;

    const userId = getUser()?.id;

    try {
        const [book, loans] = await Promise.all([
            apiRequest(`/books/${id}`),
            apiRequest('/loans/my')
        ]);

        if (getUser()?.id !== userId || cartSubmitting) return;

        const activeLoans = loans.filter(
            loan => loan.status === 'active'
        );

        if (activeLoans.some(loan => loan.is_overdue)) {
            alert(
                'Bạn đang có sách quá hạn. Vui lòng trả sách trước.'
            );
            return;
        }

        const borrowedBooks = activeLoans.reduce(
            (sum, loan) => sum + Number(loan.borrowed_books || 0),
            0
        );

        if (
            borrowedBooks + getCartQuantity() >= MAX_BORROW_BOOKS
        ) {
            alert('Bạn chỉ được mượn tối đa 3 cuốn sách.');
            return;
        }

        const available = Number(book.available_copies || 0);

        const existing = borrowCart.find(
            item => item.book_id === Number(book.id)
        );

        if (available <= (existing?.quantity || 0)) {
            alert('Không đủ số lượng sách có sẵn.');
            return;
        }

        if (existing) {
            existing.quantity += 1;
        } else {
            borrowCart.push({
                book_id: Number(book.id),
                title: book.title,
                author: book.author,
                quantity: 1
            });
        }

        updateCartCount();

        alert('Đã thêm sách vào phiếu mượn.');

    } catch (error) {
        alert(error.message);

    } finally {
        if (button) button.disabled = false;
    }
}
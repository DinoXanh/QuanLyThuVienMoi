let cartSubmitting = false;

async function loadBorrowCart(version) {
    try {
        const loans = await apiRequest('/loans/my');

        if (version !== pageVersion) return;

        const borrowed = loans
            .filter(loan => loan.status === 'active')
            .reduce(
                (sum, loan) => sum + Number(loan.borrowed_books || 0),
                0
            );

        const overdue = loans.some(
            loan => loan.status === 'active' && loan.is_overdue
        );

        renderBorrowCart(borrowed, overdue);

    } catch (error) {
        if (version !== pageVersion) return;

        pageContent.innerHTML = `
            <div class="error-message">
                ${escapeHTML(error.message)}
            </div>
        `;
    }
}

function renderBorrowCart(borrowed, overdue) {
    const user = getUser();
    const quantity = getCartQuantity();

    const remaining = overdue
        ? 0
        : Math.max(0, MAX_BORROW_BOOKS - borrowed);

    pageContent.innerHTML = `
        <div class="stats-grid">
            ${readerStatCard('Đang mượn', borrowed, 'warning')}
            ${readerStatCard('Đã chọn', quantity)}
            ${readerStatCard('Hạn mức còn lại', remaining, 'success')}
            ${readerStatCard('Thời hạn mượn (ngày)', LOAN_DURATION_DAYS)}
        </div>

        ${overdue ? `
            <div class="reader-alert">
                Bạn đang có sách quá hạn.
                Vui lòng trả sách trước khi gửi yêu cầu mới.
            </div>
        ` : ''}

        <section class="panel">
            <h3>Thông tin người mượn</h3>

            ${readerInfoRow('Họ và tên', user.full_name)}
            ${readerInfoRow('MSSV', user.mssv || '—')}
            ${readerInfoRow('Lớp', user.class_name || '—')}
        </section>

        <section class="panel">

            <div class="toolbar">
                <h3>Danh sách sách đã chọn</h3>

                <button class="btn-secondary"
                    id="continueBorrowing">
                    Chọn thêm sách
                </button>
            </div>

            ${borrowCart.length ? `
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Tên sách</th>
                                <th>Tác giả</th>
                                <th>Số lượng</th>
                                <th>Thao tác</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${borrowCart.map(item => `
                                <tr>
                                    <td>${escapeHTML(item.title)}</td>
                                    <td>${escapeHTML(item.author)}</td>

                                    <td>
                                        <div class="quantity-control">

                                            <button class="btn-secondary"
                                                data-action="decrease"
                                                data-id="${Number(item.book_id)}"
                                                ${cartSubmitting ? 'disabled' : ''}>
                                                −
                                            </button>

                                            <strong>
                                                ${Number(item.quantity)}
                                            </strong>

                                            <button class="btn-secondary"
                                                data-action="increase"
                                                data-id="${Number(item.book_id)}"
                                                ${cartSubmitting || quantity >= remaining
                                                    ? 'disabled'
                                                    : ''}>
                                                +
                                            </button>

                                        </div>
                                    </td>

                                    <td>
                                        <button class="btn-danger"
                                            data-action="remove"
                                            data-id="${Number(item.book_id)}"
                                            ${cartSubmitting ? 'disabled' : ''}>
                                            Xóa
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="cart-summary">
                    <strong>
                        Tổng số sách: ${quantity} cuốn
                    </strong>

                    <div class="action-group">
                        <button class="btn-danger"
                            id="clearBorrowCart"
                            ${cartSubmitting ? 'disabled' : ''}>
                            Xóa tất cả
                        </button>

                        <button class="btn-primary"
                            id="submitBorrowRequest"
                            ${overdue || quantity > remaining || cartSubmitting
                                ? 'disabled'
                                : ''}>
                            Gửi yêu cầu mượn
                        </button>
                    </div>
                </div>
            ` : `
                <div class="empty-message">
                    Bạn chưa chọn sách nào.
                </div>
            `}

            <p class="capacity-note">
                Sách trong phiếu mượn chưa được giữ chỗ.
                Yêu cầu cần được thủ thư phê duyệt.
            </p>

            <p id="cartMessage"
                class="form-message"
                role="alert"></p>

        </section>
    `;

    document.getElementById('continueBorrowing')
        .addEventListener('click', () => navigateTo('books'));

    pageContent.querySelectorAll('button[data-action]')
        .forEach(button => {
            button.addEventListener('click', async () => {
                if (cartSubmitting) return;

                const id = Number(button.dataset.id);
                const action = button.dataset.action;

                if (action === 'increase') {
                    await addBookToCart(id, button);
                }

                if (action === 'decrease') {
                    decreaseCartQuantity(id);
                }

                if (action === 'remove') {
                    removeCartBook(id);
                }

                if (currentPage === 'borrowCart') {
                    await navigateTo('borrowCart');
                }
            });
        });

    document.getElementById('clearBorrowCart')
        ?.addEventListener('click', clearBorrowCart);

    document.getElementById('submitBorrowRequest')
        ?.addEventListener('click', confirmBorrowRequest);
}

function decreaseCartQuantity(id) {
    const item = borrowCart.find(
        item => item.book_id === id
    );

    if (!item) return;

    item.quantity -= 1;

    if (item.quantity <= 0) {
        borrowCart = borrowCart.filter(
            item => item.book_id !== id
        );
    }

    updateCartCount();
}

function removeCartBook(id) {
    borrowCart = borrowCart.filter(
        item => item.book_id !== id
    );

    updateCartCount();
}

function clearBorrowCart() {
    if (cartSubmitting) return;

    if (!confirm('Bạn có muốn xóa toàn bộ phiếu mượn?')) {
        return;
    }

    borrowCart = [];
    updateCartCount();

    navigateTo('borrowCart');
}

function confirmBorrowRequest() {
    if (!borrowCart.length || cartSubmitting) return;

    const user = getUser();

    openModal(
        'Xác nhận phiếu mượn',
        `
            ${readerInfoRow('Họ và tên', user.full_name)}
            ${readerInfoRow('MSSV', user.mssv || '—')}
            ${readerInfoRow('Lớp', user.class_name || '—')}

            <h3 class="request-books-title">
                Danh sách sách đăng ký
            </h3>

            ${borrowCart.map(item =>
                readerInfoRow(
                    item.title,
                    `${item.quantity} cuốn`
                )
            ).join('')}

            ${readerInfoRow(
                'Tổng số lượng',
                `${getCartQuantity()} cuốn`
            )}

            ${readerInfoRow(
                'Thời hạn mượn',
                '14 ngày kể từ khi phê duyệt'
            )}

            <p class="capacity-note">
                Yêu cầu sẽ được gửi đến thủ thư để phê duyệt.
            </p>

            <p id="submitRequestMessage"
                class="form-message"
                role="alert"></p>
        `,
        `
            <button class="btn-secondary"
                id="cancelBorrowConfirm">
                Hủy
            </button>

            <button class="btn-primary"
                id="confirmBorrowButton">
                Xác nhận gửi
            </button>
        `
    );

    document.getElementById('cancelBorrowConfirm')
        .addEventListener('click', closeModal);

    document.getElementById('confirmBorrowButton')
        .addEventListener('click', submitBorrowRequest);
}

async function submitBorrowRequest() {
    if (!borrowCart.length || cartSubmitting) return;

    const button = document.getElementById('confirmBorrowButton');
    const message = document.getElementById('submitRequestMessage');
    const modal = document.getElementById('modalOverlay');
    const version = pageVersion;

    const items = borrowCart.map(item => ({
        book_id: item.book_id,
        quantity: item.quantity
    }));

    cartSubmitting = true;

    button.disabled = true;
    button.textContent = 'Đang gửi...';

    try {
        const result = await apiRequest('/borrow-requests', {
            method: 'POST',
            body: JSON.stringify({ items })
        });

        borrowCart = [];
        updateCartCount();

        if (modal.isConnected) {
            closeModal();
        }

        alert(result.message || 'Gửi yêu cầu mượn thành công');

        if (version === pageVersion) {
            await navigateTo('requests');
        }

    } catch (error) {
        if (message.isConnected) {
            message.textContent = error.message;
        } else {
            alert(error.message);
        }

    } finally {
        cartSubmitting = false;
        button.disabled = false;
        button.textContent = 'Xác nhận gửi';

        if (currentPage === 'borrowCart' && !modal.isConnected) {
            await navigateTo('borrowCart');
        }
    }
}
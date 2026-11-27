const express = require('express');
const pool = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const {
    MAX_BORROW_BOOKS,
    LOAN_DURATION_DAYS,
    BLOCK_OVERDUE_BORROWING
} = require('../config/library');

const router = express.Router();

const requestQuery = `
    SELECT br.*,
        u.full_name,
        u.mssv,
        u.class_name,
        COALESCE(
            json_agg(
                json_build_object(
                    'book_id', b.id,
                    'title', b.title,
                    'author', b.author,
                    'quantity', bri.quantity
                )
                ORDER BY bri.id
            ) FILTER (WHERE bri.id IS NOT NULL),
            '[]'::json
        ) AS items
    FROM borrow_requests br
    JOIN users u ON br.user_id = u.id
    LEFT JOIN borrow_request_items bri
        ON br.id = bri.request_id
    LEFT JOIN books b ON bri.book_id = b.id
`;

router.get('/my', authenticate,
    authorize('reader'),
    async (req, res) => {
        try {
            const result = await pool.query(
                `${requestQuery}
                 WHERE br.user_id = $1
                 GROUP BY br.id, u.id
                 ORDER BY br.created_at DESC`,
                [req.user.id]
            );

            res.json(result.rows);

        } catch (error) {
            console.error(error.message);
            res.status(500).json({
                message: 'Lỗi máy chủ'
            });
        }
    }
);

router.get('/', authenticate,
    authorize('super_admin', 'librarian'),
    async (req, res) => {
        try {
            const { status } = req.query;

            const statuses = [
                'pending',
                'approved',
                'rejected',
                'cancelled'
            ];

            if (status && !statuses.includes(status)) {
                return res.status(400).json({
                    message: 'Trạng thái không hợp lệ'
                });
            }

            const result = await pool.query(
                `${requestQuery}
                 ${status ? 'WHERE br.status = $1' : ''}
                 GROUP BY br.id, u.id
                 ORDER BY br.created_at DESC`,
                status ? [status] : []
            );

            res.json(result.rows);

        } catch (error) {
            console.error(error.message);
            res.status(500).json({
                message: 'Lỗi máy chủ'
            });
        }
    }
);

router.post('/', authenticate,
    authorize('reader'),
    async (req, res) => {
        const { items } = req.body || {};

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                message: 'Vui lòng chọn sách cần mượn'
            });
        }

        const bookIds = new Set();

        for (const item of items) {
            if (!item ||
                !Number.isInteger(item.book_id) ||
                item.book_id <= 0 ||
                !Number.isInteger(item.quantity) ||
                item.quantity <= 0 ||
                item.quantity > 100) {
                return res.status(400).json({
                    message: 'Thông tin sách không hợp lệ'
                });
            }

            if (bookIds.has(item.book_id)) {
                return res.status(400).json({
                    message: 'Đầu sách bị trùng trong yêu cầu'
                });
            }

            bookIds.add(item.book_id);
        }

        const totalRequested = items.reduce(
            (total, item) => total + item.quantity, 0
        );

        if (totalRequested > MAX_BORROW_BOOKS) {
            return res.status(400).json({
                message: `Chỉ được mượn tối đa ${MAX_BORROW_BOOKS} cuốn sách`
            });
        }

        let client;

        try {
            client = await pool.connect();
            await client.query('BEGIN');

            const borrowCheck = await client.query(
                `SELECT
                    COUNT(li.id)::int AS borrowed_books,
                    COUNT(li.id) FILTER (
                        WHERE l.due_date < CURRENT_TIMESTAMP
                    )::int AS overdue_books
                 FROM loans l
                 JOIN loan_items li ON l.id = li.loan_id
                 WHERE l.user_id = $1
                 AND l.status = 'active'
                 AND li.status = 'borrowed'`,
                [req.user.id]
            );

            const borrowedBooks =
                borrowCheck.rows[0].borrowed_books;

            const overdueBooks =
                borrowCheck.rows[0].overdue_books;

            if (BLOCK_OVERDUE_BORROWING && overdueBooks > 0) {
                await client.query('ROLLBACK');

                return res.status(409).json({
                    message: 'Bạn có sách quá hạn, vui lòng trả sách trước khi mượn thêm'
                });
            }

            if (borrowedBooks + totalRequested > MAX_BORROW_BOOKS) {
                await client.query('ROLLBACK');

                return res.status(409).json({
                    message: 'Vượt quá giới hạn mượn sách',
                    borrowed_books: borrowedBooks,
                    requested_books: totalRequested,
                    remaining_books: Math.max(
                        0, MAX_BORROW_BOOKS - borrowedBooks
                    )
                });
            }

            for (const item of items) {
                const result = await client.query(
                    `SELECT b.id, b.title,
                        COUNT(bc.id) FILTER (
                            WHERE bc.status = 'available'
                        )::int AS available_copies
                     FROM books b
                     LEFT JOIN book_copies bc
                        ON b.id = bc.book_id
                     WHERE b.id = $1
                     GROUP BY b.id`,
                    [item.book_id]
                );

                if (result.rowCount === 0) {
                    await client.query('ROLLBACK');

                    return res.status(404).json({
                        message: 'Không tìm thấy sách'
                    });
                }

                const book = result.rows[0];

                if (book.available_copies < item.quantity) {
                    await client.query('ROLLBACK');

                    return res.status(409).json({
                        message: `Không đủ số lượng sách: ${book.title}`
                    });
                }
            }

            const request = await client.query(
                `INSERT INTO borrow_requests (
                    user_id, status
                )
                VALUES ($1, 'pending')
                RETURNING *`,
                [req.user.id]
            );

            const requestId = request.rows[0].id;

            for (const item of items) {
                await client.query(
                    `INSERT INTO borrow_request_items (
                        request_id, book_id, quantity
                    )
                    VALUES ($1, $2, $3)`,
                    [
                        requestId,
                        item.book_id,
                        item.quantity
                    ]
                );
            }

            await client.query('COMMIT');

            res.status(201).json({
                message: 'Gửi yêu cầu mượn sách thành công',
                request: request.rows[0],
                items
            });

        } catch (error) {
            if (client) {
                await client.query('ROLLBACK').catch(console.error);
            }

            console.error(error.message);

            res.status(500).json({
                message: 'Lỗi máy chủ'
            });

        } finally {
            if (client) {
                client.release();
            }
        }
    }
);

router.patch('/:id/cancel', authenticate,
    authorize('reader'),
    async (req, res) => {
        try {
            const id = Number(req.params.id);

            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    message: 'ID yêu cầu không hợp lệ'
                });
            }

            const result = await pool.query(
                `UPDATE borrow_requests
                 SET status = 'cancelled'
                 WHERE id = $1
                 AND user_id = $2
                 AND status = 'pending'
                 RETURNING *`,
                [id, req.user.id]
            );

            if (result.rowCount === 0) {
                return res.status(409).json({
                    message: 'Không thể hủy yêu cầu này'
                });
            }

            res.json({
                message: 'Hủy yêu cầu thành công',
                request: result.rows[0]
            });

        } catch (error) {
            console.error(error.message);
            res.status(500).json({
                message: 'Lỗi máy chủ'
            });
        }
    }
);

router.patch('/:id/reject', authenticate,
    authorize('super_admin', 'librarian'),
    async (req, res) => {
        try {
            const id = Number(req.params.id);
            const { rejection_reason } = req.body || {};

            if (!Number.isInteger(id) || id <= 0 ||
                typeof rejection_reason !== 'string' ||
                !rejection_reason.trim()) {
                return res.status(400).json({
                    message: 'Thông tin từ chối không hợp lệ'
                });
            }

            const result = await pool.query(
                `UPDATE borrow_requests
                 SET status = 'rejected',
                     reviewed_by = $1,
                     reviewed_at = CURRENT_TIMESTAMP,
                     rejection_reason = $2
                 WHERE id = $3
                 AND status = 'pending'
                 RETURNING *`,
                [
                    req.user.id,
                    rejection_reason.trim(),
                    id
                ]
            );

            if (result.rowCount === 0) {
                return res.status(409).json({
                    message: 'Không thể từ chối yêu cầu này'
                });
            }

            res.json({
                message: 'Đã từ chối yêu cầu mượn sách',
                request: result.rows[0]
            });

        } catch (error) {
            console.error(error.message);
            res.status(500).json({
                message: 'Lỗi máy chủ'
            });
        }
    }
);

router.patch('/:id/approve', authenticate,
    authorize('super_admin', 'librarian'),
    async (req, res) => {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                message: 'ID yêu cầu không hợp lệ'
            });
        }

        let client;

        try {
            client = await pool.connect();
            await client.query('BEGIN');

            const requestResult = await client.query(
                `SELECT *
                 FROM borrow_requests
                 WHERE id = $1
                 FOR UPDATE`,
                [id]
            );

            if (requestResult.rowCount === 0) {
                await client.query('ROLLBACK');

                return res.status(404).json({
                    message: 'Không tìm thấy yêu cầu'
                });
            }

            const request = requestResult.rows[0];

            if (request.status !== 'pending') {
                await client.query('ROLLBACK');

                return res.status(409).json({
                    message: 'Yêu cầu đã được xử lý'
                });
            }

            const userResult = await client.query(
                `SELECT id, is_active, role
                 FROM users
                 WHERE id = $1
                 FOR UPDATE`,
                [request.user_id]
            );

            if (userResult.rowCount === 0 ||
                !userResult.rows[0].is_active ||
                userResult.rows[0].role !== 'reader') {
                await client.query('ROLLBACK');

                return res.status(409).json({
                    message: 'Tài khoản người mượn không hợp lệ'
                });
            }

            const itemsResult = await client.query(
                `SELECT bri.book_id,
                        bri.quantity,
                        b.title
                 FROM borrow_request_items bri
                 JOIN books b ON bri.book_id = b.id
                 WHERE bri.request_id = $1
                 ORDER BY bri.book_id`,
                [id]
            );

            const items = itemsResult.rows;

            if (items.length === 0) {
                await client.query('ROLLBACK');

                return res.status(400).json({
                    message: 'Yêu cầu không có sách'
                });
            }

            const totalRequested = items.reduce(
                (total, item) => total + item.quantity, 0
            );

            const borrowCheck = await client.query(
                `SELECT
                    COUNT(li.id)::int AS borrowed_books,
                    COUNT(li.id) FILTER (
                        WHERE l.due_date < CURRENT_TIMESTAMP
                    )::int AS overdue_books
                 FROM loans l
                 JOIN loan_items li ON l.id = li.loan_id
                 WHERE l.user_id = $1
                 AND l.status = 'active'
                 AND li.status = 'borrowed'`,
                [request.user_id]
            );

            const borrowedBooks =
                borrowCheck.rows[0].borrowed_books;

            const overdueBooks =
                borrowCheck.rows[0].overdue_books;

            if (BLOCK_OVERDUE_BORROWING && overdueBooks > 0) {
                await client.query('ROLLBACK');

                return res.status(409).json({
                    message: 'Sinh viên đang có sách quá hạn'
                });
            }

            if (borrowedBooks + totalRequested > MAX_BORROW_BOOKS) {
                await client.query('ROLLBACK');

                return res.status(409).json({
                    message: 'Sinh viên vượt quá giới hạn mượn sách'
                });
            }

            const selectedCopies = [];

            for (const item of items) {
                const copiesResult = await client.query(
                    `SELECT id, copy_code, book_id
                     FROM book_copies
                     WHERE book_id = $1
                     AND status = 'available'
                     ORDER BY id
                     LIMIT $2
                     FOR UPDATE`,
                    [item.book_id, item.quantity]
                );

                if (copiesResult.rowCount < item.quantity) {
                    await client.query('ROLLBACK');

                    return res.status(409).json({
                        message: `Không đủ số lượng sách: ${item.title}`
                    });
                }

                selectedCopies.push(...copiesResult.rows);
            }

            const loanResult = await client.query(
                `INSERT INTO loans (
                    request_id,
                    user_id,
                    approved_by,
                    borrow_date,
                    due_date,
                    status
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP + ($4::int * INTERVAL '1 day'),
                    'active'
                )
                RETURNING *`,
                [
                    id,
                    request.user_id,
                    req.user.id,
                    LOAN_DURATION_DAYS
                ]
            );

            const loan = loanResult.rows[0];

            for (const copy of selectedCopies) {
                await client.query(
                    `INSERT INTO loan_items (
                        loan_id,
                        copy_id,
                        status
                    )
                    VALUES ($1, $2, 'borrowed')`,
                    [loan.id, copy.id]
                );

                await client.query(
                    `UPDATE book_copies
                     SET status = 'on_loan'
                     WHERE id = $1`,
                    [copy.id]
                );
            }

            await client.query(
                `UPDATE borrow_requests
                 SET status = 'approved',
                     reviewed_by = $1,
                     reviewed_at = CURRENT_TIMESTAMP
                 WHERE id = $2`,
                [req.user.id, id]
            );

            await client.query('COMMIT');

            res.json({
                message: 'Duyệt yêu cầu mượn sách thành công',
                loan,
                copies: selectedCopies
            });

        } catch (error) {
            if (client) {
                await client.query('ROLLBACK').catch(console.error);
            }

            console.error(error.message);

            res.status(500).json({
                message: 'Lỗi máy chủ'
            });

        } finally {
            if (client) {
                client.release();
            }
        }
    }
);

module.exports = router;
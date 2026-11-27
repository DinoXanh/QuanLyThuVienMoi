const express = require('express');
const pool = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

const loanQuery = `
    SELECT l.*,
        u.full_name,
        u.mssv,
        u.class_name,
        a.full_name AS approved_by_name,
        COUNT(li.id) FILTER (
            WHERE li.status = 'borrowed'
        )::int AS borrowed_books,
        COUNT(li.id) FILTER (
            WHERE li.status = 'returned'
        )::int AS returned_books,
        CASE
            WHEN l.status = 'active'
            AND l.due_date < CURRENT_TIMESTAMP
            THEN true
            ELSE false
        END AS is_overdue,
        COALESCE(
            json_agg(
                json_build_object(
                    'loan_item_id', li.id,
                    'copy_id', bc.id,
                    'copy_code', bc.copy_code,
                    'book_id', b.id,
                    'title', b.title,
                    'author', b.author,
                    'status', li.status,
                    'return_date', li.return_date
                )
                ORDER BY li.id
            ) FILTER (WHERE li.id IS NOT NULL),
            '[]'::json
        ) AS items
    FROM loans l
    JOIN users u ON l.user_id = u.id
    JOIN users a ON l.approved_by = a.id
    LEFT JOIN loan_items li ON l.id = li.loan_id
    LEFT JOIN book_copies bc ON li.copy_id = bc.id
    LEFT JOIN books b ON bc.book_id = b.id
`;

router.get('/active', authenticate,
    authorize('super_admin', 'librarian'),
    async (req, res) => {
        try {
            const result = await pool.query(
                `${loanQuery}
                 WHERE l.status = 'active'
                 GROUP BY l.id, u.id, a.id
                 ORDER BY l.borrow_date DESC`
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

router.get('/returned', authenticate,
    authorize('super_admin', 'librarian'),
    async (req, res) => {
        try {
            const result = await pool.query(
                `${loanQuery}
                 WHERE l.status = 'returned'
                 GROUP BY l.id, u.id, a.id
                 ORDER BY l.return_date DESC`
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

router.get('/overdue', authenticate,
    authorize('super_admin', 'librarian'),
    async (req, res) => {
        try {
            const result = await pool.query(
                `${loanQuery}
                 WHERE l.status = 'active'
                 AND l.due_date < CURRENT_TIMESTAMP
                 GROUP BY l.id, u.id, a.id
                 ORDER BY l.due_date ASC`
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

router.get('/my', authenticate,
    authorize('reader'),
    async (req, res) => {
        try {
            const result = await pool.query(
                `${loanQuery}
                 WHERE l.user_id = $1
                 GROUP BY l.id, u.id, a.id
                 ORDER BY l.borrow_date DESC`,
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

router.get('/:id', authenticate,
    async (req, res) => {
        try {
            const id = Number(req.params.id);

            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    message: 'ID phiếu mượn không hợp lệ'
                });
            }

            const isReader = req.user.role === 'reader';

            const result = await pool.query(
                `${loanQuery}
                 WHERE l.id = $1
                 ${isReader ? 'AND l.user_id = $2' : ''}
                 GROUP BY l.id, u.id, a.id`,
                isReader ? [id, req.user.id] : [id]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({
                    message: 'Không tìm thấy phiếu mượn'
                });
            }

            res.json(result.rows[0]);

        } catch (error) {
            console.error(error.message);
            res.status(500).json({
                message: 'Lỗi máy chủ'
            });
        }
    }
);

router.patch('/items/:id/return', authenticate,
    authorize('super_admin', 'librarian'),
    async (req, res) => {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                message: 'ID chi tiết phiếu mượn không hợp lệ'
            });
        }

        let client;

        try {
            client = await pool.connect();
            await client.query('BEGIN');

            const itemResult = await client.query(
                `SELECT loan_id
                 FROM loan_items
                 WHERE id = $1`,
                [id]
            );

            if (itemResult.rowCount === 0) {
                await client.query('ROLLBACK');

                return res.status(404).json({
                    message: 'Không tìm thấy cuốn sách trong phiếu mượn'
                });
            }

            const loanId = itemResult.rows[0].loan_id;

            await client.query(
                `SELECT id
                 FROM loans
                 WHERE id = $1
                 FOR UPDATE`,
                [loanId]
            );

            const lockedItem = await client.query(
                `SELECT *
                 FROM loan_items
                 WHERE id = $1
                 FOR UPDATE`,
                [id]
            );

            const item = lockedItem.rows[0];

            if (item.status === 'returned') {
                await client.query('ROLLBACK');

                return res.status(409).json({
                    message: 'Cuốn sách này đã được trả'
                });
            }

            await client.query(
                `UPDATE loan_items
                 SET status = 'returned',
                     return_date = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [id]
            );

            const copyResult = await client.query(
                `UPDATE book_copies
                 SET status = 'available'
                 WHERE id = $1
                 AND status = 'on_loan'
                 RETURNING *`,
                [item.copy_id]
            );

            if (copyResult.rowCount === 0) {
                await client.query('ROLLBACK');

                return res.status(409).json({
                    message: 'Trạng thái cuốn sách không hợp lệ'
                });
            }

            const remainingResult = await client.query(
                `SELECT COUNT(*)::int AS remaining
                 FROM loan_items
                 WHERE loan_id = $1
                 AND status = 'borrowed'`,
                [loanId]
            );

            const remaining =
                remainingResult.rows[0].remaining;

            if (remaining === 0) {
                await client.query(
                    `UPDATE loans
                     SET status = 'returned',
                         return_date = CURRENT_TIMESTAMP
                     WHERE id = $1`,
                    [loanId]
                );
            }

            await client.query('COMMIT');

            res.json({
                message: 'Trả sách thành công',
                loan_id: loanId,
                loan_item_id: id,
                copy: copyResult.rows[0],
                remaining_books: remaining,
                loan_status: remaining === 0
                    ? 'returned'
                    : 'active'
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

router.patch('/:id/return', authenticate,
    authorize('super_admin', 'librarian'),
    async (req, res) => {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                message: 'ID phiếu mượn không hợp lệ'
            });
        }

        let client;

        try {
            client = await pool.connect();
            await client.query('BEGIN');

            const loanResult = await client.query(
                `SELECT *
                 FROM loans
                 WHERE id = $1
                 FOR UPDATE`,
                [id]
            );

            if (loanResult.rowCount === 0) {
                await client.query('ROLLBACK');

                return res.status(404).json({
                    message: 'Không tìm thấy phiếu mượn'
                });
            }

            const loan = loanResult.rows[0];

            if (loan.status === 'returned') {
                await client.query('ROLLBACK');

                return res.status(409).json({
                    message: 'Phiếu mượn này đã được trả'
                });
            }

            const itemsResult = await client.query(
                `SELECT *
                 FROM loan_items
                 WHERE loan_id = $1
                 AND status = 'borrowed'
                 ORDER BY copy_id
                 FOR UPDATE`,
                [id]
            );

            if (itemsResult.rowCount === 0) {
                await client.query('ROLLBACK');

                return res.status(409).json({
                    message: 'Không còn sách cần trả'
                });
            }

            const returnedCopies = [];

            for (const item of itemsResult.rows) {
                const copyResult = await client.query(
                    `UPDATE book_copies
                     SET status = 'available'
                     WHERE id = $1
                     AND status = 'on_loan'
                     RETURNING *`,
                    [item.copy_id]
                );

                if (copyResult.rowCount === 0) {
                    await client.query('ROLLBACK');

                    return res.status(409).json({
                        message: 'Trạng thái cuốn sách không hợp lệ'
                    });
                }

                await client.query(
                    `UPDATE loan_items
                     SET status = 'returned',
                         return_date = CURRENT_TIMESTAMP
                     WHERE id = $1`,
                    [item.id]
                );

                returnedCopies.push(copyResult.rows[0]);
            }

            const updatedLoan = await client.query(
                `UPDATE loans
                 SET status = 'returned',
                     return_date = CURRENT_TIMESTAMP
                 WHERE id = $1
                 RETURNING *`,
                [id]
            );

            await client.query('COMMIT');

            res.json({
                message: 'Trả toàn bộ phiếu mượn thành công',
                loan: updatedLoan.rows[0],
                returned_books: returnedCopies.length,
                copies: returnedCopies
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
const express = require('express');
const pool = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/capacity', authenticate, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT total_copies FROM library_capacity WHERE id = 1'
        );

        const total = result.rows[0].total_copies;

        res.json({
            total_copies: total,
            max_capacity: 100,
            remaining_capacity: 100 - total
        });

    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: 'Lỗi máy chủ'
        });
    }
});

router.get('/', authenticate,
    authorize('super_admin', 'librarian'),
    async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT bc.*, b.title, b.author
                 FROM book_copies bc
                 JOIN books b ON bc.book_id = b.id
                 ORDER BY bc.id`
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

router.get('/book/:bookId', authenticate,
    authorize('super_admin', 'librarian'),
    async (req, res) => {
        try {
            const bookId = Number(req.params.bookId);

            if (!Number.isInteger(bookId) || bookId <= 0) {
                return res.status(400).json({
                    message: 'ID sách không hợp lệ'
                });
            }

            const result = await pool.query(
                `SELECT * FROM book_copies
                 WHERE book_id = $1
                 ORDER BY id`,
                [bookId]
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
    authorize('super_admin', 'librarian'),
    async (req, res) => {
        try {
            const { book_id, copy_code } = req.body || {};

            if (!Number.isInteger(book_id) || book_id <= 0 ||
                typeof copy_code !== 'string' ||
                !copy_code.trim() ||
                copy_code.trim().length > 30) {
                return res.status(400).json({
                    message: 'Thông tin cuốn sách không hợp lệ'
                });
            }

            const result = await pool.query(
                `INSERT INTO book_copies (
                    book_id, copy_code, status
                )
                VALUES ($1, $2, 'available')
                RETURNING *`,
                [book_id, copy_code.trim().toUpperCase()]
            );

            res.status(201).json({
                message: 'Thêm cuốn sách thành công',
                copy: result.rows[0]
            });

        } catch (error) {
            if (error.code === '23505') {
                return res.status(409).json({
                    message: 'Mã cuốn sách đã tồn tại'
                });
            }

            if (error.code === '23503') {
                return res.status(400).json({
                    message: 'Đầu sách không tồn tại'
                });
            }

            if (error.code === '23514' &&
                error.table === 'library_capacity') {
                return res.status(409).json({
                    message: 'Thư viện đã đạt giới hạn 100 cuốn sách'
                });
            }

            console.error(error.message);
            res.status(500).json({
                message: 'Lỗi máy chủ'
            });
        }
    }
);

router.delete('/:id', authenticate,
    authorize('super_admin', 'librarian'),
    async (req, res) => {
        try {
            const id = Number(req.params.id);

            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    message: 'ID không hợp lệ'
                });
            }

            const result = await pool.query(
                `DELETE FROM book_copies
                 WHERE id = $1
                 AND status = 'available'
                 RETURNING id`,
                [id]
            );

            if (result.rowCount === 0) {
                const check = await pool.query(
                    'SELECT id FROM book_copies WHERE id = $1',
                    [id]
                );

                if (check.rowCount === 0) {
                    return res.status(404).json({
                        message: 'Không tìm thấy cuốn sách'
                    });
                }

                return res.status(409).json({
                    message: 'Không thể xóa cuốn sách đang được mượn'
                });
            }

            res.json({
                message: 'Xóa cuốn sách thành công'
            });

        } catch (error) {
            if (error.code === '23503') {
                return res.status(409).json({
                    message: 'Không thể xóa cuốn sách có lịch sử mượn'
                });
            }

            console.error(error.message);
            res.status(500).json({
                message: 'Lỗi máy chủ'
            });
        }
    }
);

module.exports = router;
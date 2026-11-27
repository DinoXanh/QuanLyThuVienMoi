const express = require('express');
const pool = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const {
    syncBookEmbedding
} = require('../services/bookEmbedding');

const router = express.Router();

const bookQuery = `
    SELECT b.*, c.name AS category_name,
        COUNT(bc.id)::int AS total_copies,
        COUNT(bc.id) FILTER (
            WHERE bc.status = 'available'
        )::int AS available_copies,
        COUNT(bc.id) FILTER (
            WHERE bc.status = 'on_loan'
        )::int AS borrowed_copies
    FROM books b
    LEFT JOIN categories c ON b.category_id = c.id
    LEFT JOIN book_copies bc ON b.id = bc.book_id
`;

router.get('/', authenticate, async (req, res) => {
    try {
        const { search, category_id } = req.query;
        const conditions = [];
        const values = [];

        if (search) {
            values.push(`%${search}%`);
            conditions.push(
                `(b.title ILIKE $${values.length}
                OR b.author ILIKE $${values.length})`
            );
        }

        if (category_id) {
            const id = Number(category_id);

            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    message: 'Danh mục không hợp lệ'
                });
            }

            values.push(id);
            conditions.push(
                `b.category_id = $${values.length}`
            );
        }

        const where = conditions.length
            ? 'WHERE ' + conditions.join(' AND ')
            : '';

        const result = await pool.query(
            `${bookQuery}
             ${where}
             GROUP BY b.id, c.name
             ORDER BY b.id DESC`,
            values
        );

        res.json(result.rows);

    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: 'Lỗi máy chủ'
        });
    }
});

router.get('/:id', authenticate, async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                message: 'ID không hợp lệ'
            });
        }

        const result = await pool.query(
            `${bookQuery}
             WHERE b.id = $1
             GROUP BY b.id, c.name`,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                message: 'Không tìm thấy sách'
            });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: 'Lỗi máy chủ'
        });
    }
});

function validateBook(data) {
    const { title, author, category_id,
        publisher, publication_year,
        description, cover_url } = data;

    if (typeof title !== 'string' ||
        !title.trim() || title.trim().length > 255 ||
        typeof author !== 'string' ||
        !author.trim() || author.trim().length > 150) {
        return false;
    }

    if (category_id != null &&
        (!Number.isInteger(category_id) || category_id <= 0)) {
        return false;
    }

    if (publication_year != null &&
        (!Number.isInteger(publication_year) ||
        publication_year <= 0 ||
        publication_year > new Date().getFullYear())) {
        return false;
    }

    if (publisher != null &&
        (typeof publisher !== 'string' ||
        publisher.length > 150)) {
        return false;
    }

    if (description != null &&
        typeof description !== 'string') {
        return false;
    }

    if (cover_url != null &&
        typeof cover_url !== 'string') {
        return false;
    }

    return true;
}

function bookValues(data) {
    return [
        data.title.trim(),
        data.author.trim(),
        data.category_id ?? null,
        data.publisher || null,
        data.publication_year ?? null,
        data.description || null,
        data.cover_url || null
    ];
}

router.post('/', authenticate,
    authorize('super_admin', 'librarian'),
    async (req, res) => {
        try {
            const data = req.body || {};

            if (!validateBook(data)) {
                return res.status(400).json({
                    message: 'Thông tin sách không hợp lệ'
                });
            }

            const result = await pool.query(
                `INSERT INTO books (
                    title, author, category_id,
                    publisher, publication_year,
                    description, cover_url
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *`,
                bookValues(data)
            );

            await syncBookEmbedding(result.rows[0].id)
                .catch(error => {
                    console.error('Lỗi đồng bộ AI:', error.message);
                });

            res.status(201).json({
                message: 'Thêm sách thành công',
                book: result.rows[0]
            });

        } catch (error) {
            if (error.code === '23503') {
                return res.status(400).json({
                    message: 'Danh mục không tồn tại'
                });
            }

            console.error(error.message);
            res.status(500).json({
                message: 'Lỗi máy chủ'
            });
        }
    }
);

router.put('/:id', authenticate,
    authorize('super_admin', 'librarian'),
    async (req, res) => {
        try {
            const id = Number(req.params.id);
            const data = req.body || {};

            if (!Number.isInteger(id) || id <= 0 ||
                !validateBook(data)) {
                return res.status(400).json({
                    message: 'Thông tin sách không hợp lệ'
                });
            }

            const result = await pool.query(
                `UPDATE books
                 SET title = $1,
                     author = $2,
                     category_id = $3,
                     publisher = $4,
                     publication_year = $5,
                     description = $6,
                     cover_url = $7
                 WHERE id = $8
                 RETURNING *`,
                [...bookValues(data), id]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({
                    message: 'Không tìm thấy sách'
                });
            }
            await syncBookEmbedding(result.rows[0].id)
                .catch(error => {
                   console.error('Lỗi đồng bộ AI:', error.message);
                });
            res.json({
                message: 'Cập nhật sách thành công',
                book: result.rows[0]
            });

        } catch (error) {
            if (error.code === '23503') {
                return res.status(400).json({
                    message: 'Danh mục không tồn tại'
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
                'DELETE FROM books WHERE id = $1 RETURNING id',
                [id]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({
                    message: 'Không tìm thấy sách'
                });
            }

            res.json({
                message: 'Xóa sách thành công'
            });

        } catch (error) {
            if (error.code === '23503') {
                return res.status(409).json({
                    message: 'Không thể xóa sách đang có bản sao hoặc dữ liệu mượn liên quan'
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
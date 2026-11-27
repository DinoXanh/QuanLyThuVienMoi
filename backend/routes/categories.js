const express = require('express');
const pool = require('../database');
const {
    syncCategoryEmbeddings
} = require('../services/bookEmbedding');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.*,
                COUNT(bc.book_id)::int AS total_books
            FROM categories c
            LEFT JOIN book_categories bc
                ON c.id = bc.category_id
            GROUP BY c.id
            ORDER BY c.id
        `);

        res.json(result.rows);

    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: 'Lỗi máy chủ'
        });
    }
});

function validateCategory(name, description) {
    return (
        typeof name === 'string' &&
        name.trim().length > 0 &&
        name.trim().length <= 100 &&
        (
            description == null ||
            typeof description === 'string'
        )
    );
}

router.post('/', authenticate,
    authorize('super_admin', 'librarian'),
    async (req, res) => {
        try {
            const { name, description } = req.body || {};

            if (!validateCategory(name, description)) {
                return res.status(400).json({
                    message: 'Thông tin danh mục không hợp lệ'
                });
            }

            const result = await pool.query(
                `INSERT INTO categories (name, description)
                 VALUES ($1, $2)
                 RETURNING *`,
                [
                    name.trim(),
                    description?.trim() || null
                ]
            );

            res.status(201).json({
                message: 'Thêm danh mục thành công',
                category: result.rows[0]
            });

        } catch (error) {
            if (error.code === '23505') {
                return res.status(409).json({
                    message: 'Danh mục đã tồn tại'
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
            const { name, description } = req.body || {};

            if (
                !Number.isInteger(id) ||
                id <= 0 ||
                !validateCategory(name, description)
            ) {
                return res.status(400).json({
                    message: 'Dữ liệu không hợp lệ'
                });
            }

            const result = await pool.query(
                `UPDATE categories
                 SET name = $1,
                     description = $2
                 WHERE id = $3
                 RETURNING *`,
                [
                    name.trim(),
                    description?.trim() || null,
                    id
                ]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({
                    message: 'Không tìm thấy danh mục'
                });
            }

            await syncCategoryEmbeddings(id)
                .catch(error => {
                    console.error(
                        'Lỗi đồng bộ AI:',
                        error.message
                    );
                });

            res.json({
                message: 'Cập nhật danh mục thành công',
                category: result.rows[0]
            });

        } catch (error) {
            if (error.code === '23505') {
                return res.status(409).json({
                    message: 'Danh mục đã tồn tại'
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
                `DELETE FROM categories
                 WHERE id = $1
                 RETURNING id`,
                [id]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({
                    message: 'Không tìm thấy danh mục'
                });
            }

            res.json({
                message: 'Xóa danh mục thành công'
            });

        } catch (error) {
            if (error.code === '23503') {
                return res.status(409).json({
                    message: 'Không thể xóa danh mục đang được sách sử dụng'
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
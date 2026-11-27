const express = require('express');
const pool = require('../database');
const {
    syncCategoryEmbeddings
} = require('../services/bookEmbedding');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM categories ORDER BY id'
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: 'Lỗi máy chủ'
        });
    }
});

router.post('/', authenticate,
    authorize('super_admin', 'librarian'),
    async (req, res) => {
        try {
            const { name, description } = req.body || {};

            if (typeof name !== 'string' ||
                !name.trim() || name.trim().length > 100) {
                return res.status(400).json({
                    message: 'Tên danh mục không hợp lệ'
                });
            }

            const result = await pool.query(
                `INSERT INTO categories (name, description)
                 VALUES ($1, $2)
                 RETURNING *`,
                [name.trim(), description || null]
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

            if (!Number.isInteger(id) || id <= 0 ||
                typeof name !== 'string' ||
                !name.trim() || name.trim().length > 100) {
                return res.status(400).json({
                    message: 'Dữ liệu không hợp lệ'
                });
            }

            const result = await pool.query(
                `UPDATE categories
                 SET name = $1, description = $2
                 WHERE id = $3
                 RETURNING *`,
                [name.trim(), description || null, id]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({
                    message: 'Không tìm thấy danh mục'
                });
            }
            await syncCategoryEmbeddings(result.rows[0].id)
                .catch(error => {
                    console.error('Lỗi đồng bộ AI:', error.message);
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
                'DELETE FROM categories WHERE id = $1 RETURNING id',
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
                    message: 'Không thể xóa danh mục đang chứa sách'
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
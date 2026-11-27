const express = require('express');
const pool = require('../database');
const { authenticate } = require('../middleware/auth');

const {
    generateEmbedding
} = require('../services/embedding');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
    try {
        const query = req.query.q;

        if (
            typeof query !== 'string' ||
            !query.trim() ||
            query.length > 500
        ) {
            return res.status(400).json({
                message: 'Nội dung tìm kiếm không hợp lệ'
            });
        }

        const limit = Number(req.query.limit ?? 10);

        if (
            !Number.isInteger(limit) ||
            limit < 1 ||
            limit > 20
        ) {
            return res.status(400).json({
                message: 'Số lượng kết quả không hợp lệ'
            });
        }

        const embedding = await generateEmbedding(
            query,
            'query'
        );

        const result = await pool.query(`
            SELECT
                b.*,
                c.name AS category_name,

                (
                    SELECT COUNT(*)::int
                    FROM book_copies bc
                    WHERE bc.book_id = b.id
                ) AS total_copies,

                (
                    SELECT COUNT(*)::int
                    FROM book_copies bc
                    WHERE bc.book_id = b.id
                    AND bc.status = 'available'
                ) AS available_copies,

                (
                    SELECT COUNT(*)::int
                    FROM book_copies bc
                    WHERE bc.book_id = b.id
                    AND bc.status = 'on_loan'
                ) AS borrowed_copies,

                1 - (
                    be.embedding <=> $1::vector
                ) AS similarity

            FROM book_embeddings be
            JOIN books b ON be.book_id = b.id
            LEFT JOIN categories c
                ON b.category_id = c.id

            WHERE be.embedding IS NOT NULL
            AND 1 - (be.embedding <=> $1::vector) >= 0.80


            ORDER BY be.embedding <=> $1::vector

            LIMIT $2
        `, [
            JSON.stringify(embedding),
            limit
        ]);

        res.json({
            query: query.trim(),
            total_results: result.rowCount,
            results: result.rows
        });

    } catch (error) {
        console.error(error.message);

        res.status(500).json({
            message: 'Lỗi tìm kiếm thông minh'
        });
    }
});

module.exports = router;
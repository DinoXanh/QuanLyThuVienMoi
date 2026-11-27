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
                cats.category_name,
                cats.category_ids,
                cats.categories,
                copies.total_copies,
                copies.available_copies,
                copies.borrowed_copies,

                1 - (
                    be.embedding <=> $1::vector
                ) AS similarity

            FROM book_embeddings be

            JOIN books b ON be.book_id = b.id

            CROSS JOIN LATERAL (
                SELECT
                    string_agg(
                        c.name, ', ' ORDER BY c.id
                    ) AS category_name,

                    COALESCE(
                        array_agg(c.id ORDER BY c.id),
                        ARRAY[]::int[]
                    ) AS category_ids,

                    COALESCE(
                        json_agg(
                            json_build_object(
                                'id', c.id,
                                'name', c.name
                            ) ORDER BY c.id
                        ),
                        '[]'::json
                    ) AS categories

                FROM book_categories bc
                JOIN categories c
                    ON c.id = bc.category_id
                WHERE bc.book_id = b.id
            ) cats

            CROSS JOIN LATERAL (
                SELECT
                    COUNT(*)::int AS total_copies,

                    COUNT(*) FILTER (
                        WHERE status = 'available'
                    )::int AS available_copies,

                    COUNT(*) FILTER (
                        WHERE status = 'on_loan'
                    )::int AS borrowed_copies

                FROM book_copies
                WHERE book_id = b.id
            ) copies

            WHERE be.embedding IS NOT NULL

            AND 1 - (
                be.embedding <=> $1::vector
            ) >= 0.80

            ORDER BY
                be.embedding <=> $1::vector,
                b.id

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
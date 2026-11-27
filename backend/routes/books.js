const express = require('express');
const pool = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const {
    syncBookEmbedding
} = require('../services/bookEmbedding');

const router = express.Router();

const bookQuery = `
    SELECT b.*, cats.category_name, cats.category_ids, cats.categories,
        copies.total_copies, copies.available_copies, copies.borrowed_copies
    FROM books b
    CROSS JOIN LATERAL (
        SELECT string_agg(c.name, ', ' ORDER BY c.id) AS category_name,
            COALESCE(array_agg(c.id ORDER BY c.id), ARRAY[]::int[]) AS category_ids,
            COALESCE(json_agg(json_build_object('id', c.id, 'name', c.name)
                ORDER BY c.id), '[]'::json) AS categories
        FROM book_categories bc
        JOIN categories c ON c.id = bc.category_id
        WHERE bc.book_id = b.id
    ) cats
    CROSS JOIN LATERAL (
        SELECT COUNT(*)::int AS total_copies,
            COUNT(*) FILTER (WHERE status = 'available')::int AS available_copies,
            COUNT(*) FILTER (WHERE status = 'on_loan')::int AS borrowed_copies
        FROM book_copies WHERE book_id = b.id
    ) copies
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
                `EXISTS (SELECT 1 FROM book_categories bc
                    WHERE bc.book_id = b.id
                    AND bc.category_id = $${values.length})`
            );
        }

        const where = conditions.length
            ? 'WHERE ' + conditions.join(' AND ')
            : '';

        const result = await pool.query(
            `${bookQuery}
             ${where}
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
             WHERE b.id = $1`,
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
    const {
        title,
        author,
        category_id,
        publisher,
        publication_year,
        description,
        cover_url
    } = data;

    if (
        typeof title !== 'string' ||
        !title.trim() ||
        title.trim().length > 255 ||
        typeof author !== 'string' ||
        !author.trim() ||
        author.trim().length > 150
    ) {
        return false;
    }

    if (
        data.category_ids !== undefined &&
        (
            !Array.isArray(data.category_ids) ||
            !data.category_ids.every(id =>
                Number.isInteger(id) &&
                id > 0 &&
                id <= 2147483647
            )
        )
    ) {
        return false;
    }

    if (
        category_id != null &&
        (!Number.isInteger(category_id) || category_id <= 0)
    ) {
        return false;
    }

    if (
        publication_year != null &&
        (
            !Number.isInteger(publication_year) ||
            publication_year <= 0 ||
            publication_year > new Date().getFullYear()
        )
    ) {
        return false;
    }

    if (
        publisher != null &&
        (
            typeof publisher !== 'string' ||
            publisher.length > 150
        )
    ) {
        return false;
    }

    if (
        description != null &&
        typeof description !== 'string'
    ) {
        return false;
    }

    if (
        cover_url != null &&
        typeof cover_url !== 'string'
    ) {
        return false;
    }

    return true;
}

function bookValues(data, ids) {
    return [
        data.title.trim(),
        data.author.trim(),
        ids[0] ?? null,
        data.publisher || null,
        data.publication_year ?? null,
        data.description || null,
        data.cover_url || null
    ];
}

async function saveBook(req, res, updating) {
    const data = req.body || {};
    const id = updating ? Number(req.params.id) : null;

    if (
        (updating && (!Number.isInteger(id) || id <= 0)) ||
        !validateBook(data)
    ) {
        return res.status(400).json({
            message: 'Thông tin sách không hợp lệ'
        });
    }

    let client;
    let book;

    try {
        client = await pool.connect();

        await client.query('BEGIN');

        let existingIds = [];

        if (updating) {
            const existing = await client.query(
                `SELECT id FROM books
                 WHERE id = $1 FOR UPDATE`,
                [id]
            );

            if (!existing.rowCount) {
                await client.query('ROLLBACK');

                return res.status(404).json({
                    message: 'Không tìm thấy sách'
                });
            }

            const links = await client.query(
                `SELECT category_id
                 FROM book_categories
                 WHERE book_id = $1
                 ORDER BY category_id`,
                [id]
            );

            existingIds = links.rows.map(
                row => row.category_id
            );
        }

        const ids = [
            ...new Set(
                data.category_ids !== undefined
                    ? data.category_ids
                    : updating && existingIds.length > 1
                        ? existingIds
                        : data.category_id != null
                            ? [data.category_id]
                            : []
            )
        ];

        const result = updating
            ? await client.query(
                `UPDATE books
                 SET title = $1,
                     author = $2,
                     category_id = $3,
                     publisher = $4,
                     publication_year = $5,
                     description = $6,
                     cover_url = $7
                 WHERE id = $8
                 RETURNING id`,
                [...bookValues(data, ids), id]
            )
            : await client.query(
                `INSERT INTO books (
                    title,
                    author,
                    category_id,
                    publisher,
                    publication_year,
                    description,
                    cover_url
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id`,
                bookValues(data, ids)
            );

        const bookId = result.rows[0].id;

        await client.query(
            `DELETE FROM book_categories
             WHERE book_id = $1`,
            [bookId]
        );

        await client.query(
            `INSERT INTO book_categories (
                book_id,
                category_id
            )
            SELECT $1, unnest($2::int[])`,
            [bookId, ids]
        );

        const saved = await client.query(
            `${bookQuery}
             WHERE b.id = $1`,
            [bookId]
        );

        book = saved.rows[0];

        await client.query('COMMIT');

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK')
                .catch(console.error);
        }

        if (error.code === '23503') {
            return res.status(400).json({
                message: 'Danh mục không tồn tại'
            });
        }

        console.error(error.message);

        return res.status(500).json({
            message: 'Lỗi máy chủ'
        });

    } finally {
        if (client) {
            client.release();
        }
    }

    await syncBookEmbedding(book.id)
        .catch(error => {
            console.error(
                'Lỗi đồng bộ AI:',
                error.message
            );
        });

    res.status(updating ? 200 : 201).json({
        message: updating
            ? 'Cập nhật sách thành công'
            : 'Thêm sách thành công',
        book
    });
}

router.post(
    '/',
    authenticate,
    authorize('super_admin', 'librarian'),
    (req, res) => saveBook(req, res, false)
);

router.put(
    '/:id',
    authenticate,
    authorize('super_admin', 'librarian'),
    (req, res) => saveBook(req, res, true)
);

router.delete(
    '/:id',
    authenticate,
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
                `DELETE FROM books
                 WHERE id = $1
                 RETURNING id`,
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
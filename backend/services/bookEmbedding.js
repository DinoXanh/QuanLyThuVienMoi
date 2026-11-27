const pool = require('../database');

const {
    generateEmbedding,
    createBookText
} = require('./embedding');

async function syncBookEmbedding(bookId) {
    const result = await pool.query(`
        SELECT b.*,
            (
                SELECT string_agg(c.name, ', ' ORDER BY c.id)
                FROM book_categories bc
                JOIN categories c
                    ON c.id = bc.category_id
                WHERE bc.book_id = b.id
            ) AS category_name
        FROM books b
        WHERE b.id = $1
    `, [bookId]);

    if (result.rowCount === 0) {
        return false;
    }

    const book = result.rows[0];

    const embedding = await generateEmbedding(
        createBookText(book),
        'passage'
    );

    await pool.query(`
        INSERT INTO book_embeddings (
            book_id,
            embedding,
            updated_at
        )
        VALUES ($1, $2::vector, CURRENT_TIMESTAMP)
        ON CONFLICT (book_id)
        DO UPDATE SET
            embedding = EXCLUDED.embedding,
            updated_at = CURRENT_TIMESTAMP
    `, [
        bookId,
        JSON.stringify(embedding)
    ]);

    return true;
}

async function syncCategoryEmbeddings(categoryId) {
    const result = await pool.query(`
        SELECT book_id AS id
        FROM book_categories
        WHERE category_id = $1
        ORDER BY book_id
    `, [categoryId]);

    const failed = [];

    for (const book of result.rows) {
        try {
            await syncBookEmbedding(book.id);
        } catch (error) {
            failed.push(book.id);
            console.error(
                `Lỗi đồng bộ sách ${book.id}:`,
                error.message
            );
        }
    }

    if (failed.length > 0) {
        throw new Error(
            `Không thể đồng bộ sách: ${failed.join(', ')}`
        );
    }
}

module.exports = {
    syncBookEmbedding,
    syncCategoryEmbeddings
};
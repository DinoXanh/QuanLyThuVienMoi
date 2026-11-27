const pool = require('../database');

const {
    generateEmbedding,
    createBookText
} = require('./embedding');

async function syncBookEmbedding(bookId) {
    const result = await pool.query(`
        SELECT b.*, c.name AS category_name
        FROM books b
        LEFT JOIN categories c
            ON b.category_id = c.id
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
        SELECT id
        FROM books
        WHERE category_id = $1
        ORDER BY id
    `, [categoryId]);

    for (const book of result.rows) {
        await syncBookEmbedding(book.id);
    }
}

module.exports = {
    syncBookEmbedding,
    syncCategoryEmbeddings
};
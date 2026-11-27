const pool = require('../database');

const {
    generateEmbedding,
    createBookText
} = require('../services/embedding');

async function generateAllEmbeddings() {
    try {
        const result = await pool.query(`
            SELECT b.*, c.name AS category_name
            FROM books b
            LEFT JOIN categories c
                ON b.category_id = c.id
            ORDER BY b.id
        `);

        const books = result.rows;

        console.log(`Tổng số đầu sách: ${books.length}`);

        let success = 0;
        let failed = 0;

        for (const book of books) {
            try {
                const text = createBookText(book);

                const embedding = await generateEmbedding(
                    text,
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
                    book.id,
                    JSON.stringify(embedding)
                ]);

                success++;

                console.log(
                    `[${success + failed}/${books.length}] ${book.title}`
                );

            } catch (error) {
                failed++;

                console.error(
                    `Lỗi sách ID ${book.id}:`,
                    error.message
                );
            }
        }

        console.log('Hoàn thành tạo Embedding');
        console.log('Thành công:', success);
        console.log('Thất bại:', failed);

        if (failed > 0) {
            process.exitCode = 1;
        }

    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;

    } finally {
        await pool.end();
    }
}

generateAllEmbeddings();
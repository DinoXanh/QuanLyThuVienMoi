const pool = require('../database');

const {
    syncBookEmbedding
} = require('../services/bookEmbedding');

async function generateAllEmbeddings() {
    try {
        const result = await pool.query(`
            SELECT id, title
            FROM books
            ORDER BY id
        `);

        const books = result.rows;

        console.log(`Tổng số đầu sách: ${books.length}`);

        let success = 0;
        let failed = 0;

        for (const book of books) {
            try {
                const synced = await syncBookEmbedding(book.id);

                if (!synced) {
                    throw new Error('Không tìm thấy sách');
                }

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
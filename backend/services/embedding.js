const MODEL_NAME = 'Xenova/multilingual-e5-small';

let extractorPromise = null;

async function getExtractor() {
    if (!extractorPromise) {
        extractorPromise = (async () => {
            const { pipeline } = await import(
                '@huggingface/transformers'
            );

            console.log('Đang tải mô hình AI...');

            const extractor = await pipeline(
                'feature-extraction',
                MODEL_NAME,
                {
                    dtype: 'q8',
                    device: 'cpu'
                }
            );

            console.log('Mô hình AI đã sẵn sàng');

            return extractor;
        })().catch(error => {
            extractorPromise = null;
            throw error;
        });
    }

    return extractorPromise;
}

async function generateEmbedding(text, type = 'passage') {
    if (typeof text !== 'string' || !text.trim()) {
        throw new Error('Nội dung không hợp lệ');
    }

    if (!['query', 'passage'].includes(type)) {
        throw new Error('Loại Embedding không hợp lệ');
    }

    const extractor = await getExtractor();

    const output = await extractor(
        `${type}: ${text.trim()}`,
        {
            pooling: 'mean',
            normalize: true
        }
    );

    const embedding = Array.from(output.data);

    if (
        embedding.length !== 384 ||
        !embedding.every(Number.isFinite)
    ) {
        throw new Error('Vector không hợp lệ');
    }

    return embedding;
}

function createBookText(book) {
    return [
        `Tên sách: ${book.title || ''}`,
        `Tác giả: ${book.author || ''}`,
        `Danh mục: ${book.category_name || ''}`,
        `Nhà xuất bản: ${book.publisher || ''}`,
        `Năm xuất bản: ${book.publication_year || ''}`,
        `Mô tả: ${book.description || ''}`
    ].join('\n');
}

module.exports = {
    generateEmbedding,
    createBookText
};
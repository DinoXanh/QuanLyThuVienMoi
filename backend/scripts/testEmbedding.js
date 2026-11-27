const {
    generateEmbedding
} = require('../services/embedding');

async function test() {
    try {
        const text = 'Tôi muốn học lập trình Java';

        console.log('Nội dung:', text);

        const start = Date.now();

        const embedding = await generateEmbedding(
            text,
            'query'
        );

        console.log('Số chiều:', embedding.length);

        console.log(
            '10 giá trị đầu tiên:',
            embedding.slice(0, 10)
        );

        console.log(
            'Thời gian xử lý:',
            Date.now() - start,
            'ms'
        );

        console.log('Kiểm thử AI thành công');

    } catch (error) {
        console.error('Lỗi:', error.message);
        process.exitCode = 1;
    }
}

test();
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const FRONTEND_DIR = path.join(__dirname, 'frontend');
const OUTPUT_DIR = path.join(__dirname, 'docs', 'screenshots');
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Simple HTTP server for frontend
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(FRONTEND_DIR, reqPath);
    
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(4321, async () => {
    console.log('Static server running on http://localhost:4321');
    
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: 'new',
        defaultViewport: { width: 1400, height: 900, deviceScaleFactor: 2 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    async function wait(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    try {
        console.log('1. Capturing Login Page...');
        await page.goto('http://localhost:4321/index.html', { waitUntil: 'networkidle2' });
        await wait(1000);
        await page.screenshot({ path: path.join(OUTPUT_DIR, 'Hinh_4_1_Dang_nhap.png') });

        console.log('2. Logging in as Reader (DinoXanh)...');
        await page.type('#username', 'DinoXanh');
        await page.type('#password', 'SemSamSi1234');
        await page.click('#loginButton');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        await wait(2500);

        console.log('3. Capturing Reader Dashboard...');
        await page.screenshot({ path: path.join(OUTPUT_DIR, 'Hinh_4_2_Trang_chu_Doc_gia.png') });

        console.log('4. Capturing Reader Books / AI Search...');
        // Click menu item Tra cuu sach or AI Search
        const booksBtn = await page.$('button[data-page="books"]');
        if (booksBtn) {
            await booksBtn.click();
            await wait(2500);
            await page.screenshot({ path: path.join(OUTPUT_DIR, 'Hinh_4_3_Tra_cuu_sach_va_goi_y.png') });
        }

        const aiBtn = await page.$('button[data-page="aiSearch"]');
        if (aiBtn) {
            await aiBtn.click();
            await wait(2000);
            await page.screenshot({ path: path.join(OUTPUT_DIR, 'Hinh_4_4_Tim_kiem_AI_ngu_nghia.png') });
        }

        console.log('5. Capturing Reader Loans & Requests...');
        const loansBtn = await page.$('button[data-page="activeLoans"]');
        if (loansBtn) {
            await loansBtn.click();
            await wait(2000);
            await page.screenshot({ path: path.join(OUTPUT_DIR, 'Hinh_4_5_Sach_dang_muon_va_han_tra.png') });
        }

        console.log('6. Logging out and Logging in as Admin...');
        await page.goto('http://localhost:4321/index.html', { waitUntil: 'networkidle2' });
        await page.evaluate(() => {
            sessionStorage.clear();
            localStorage.clear();
        });
        await page.reload({ waitUntil: 'networkidle2' });
        await wait(1000);

        await page.type('#username', 'admin');
        await page.type('#password', 'NTP21042004@');
        await page.click('#loginButton');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        await wait(2500);

        console.log('7. Capturing Admin Dashboard...');
        await page.screenshot({ path: path.join(OUTPUT_DIR, 'Hinh_4_6_Admin_Tong_quan.png') });

        console.log('8. Capturing Admin Books Management...');
        const adminBooksBtn = await page.$('button[data-page="books"]');
        if (adminBooksBtn) {
            await adminBooksBtn.click();
            await wait(2500);
            await page.screenshot({ path: path.join(OUTPUT_DIR, 'Hinh_4_7_Admin_Quan_ly_sach.png') });
        }

        console.log('9. Capturing Admin Borrow Requests...');
        const adminReqBtn = await page.$('button[data-page="requests"]');
        if (adminReqBtn) {
            await adminReqBtn.click();
            await wait(2500);
            await page.screenshot({ path: path.join(OUTPUT_DIR, 'Hinh_4_8_Admin_Duyet_muon_tra.png') });
        }

        console.log('10. Capturing Admin Statistics...');
        const adminStatsBtn = await page.$('button[data-page="statistics"]');
        if (adminStatsBtn) {
            await adminStatsBtn.click();
            await wait(2500);
            await page.screenshot({ path: path.join(OUTPUT_DIR, 'Hinh_4_9_Admin_Thong_ke_Bao_cao.png') });
        }

        console.log('All screenshots captured successfully!');
    } catch (err) {
        console.error('Error during screenshot capture:', err);
    } finally {
        await browser.close();
        server.close();
    }
});

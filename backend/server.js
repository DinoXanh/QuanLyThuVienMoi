require('dotenv').config();

const express = require('express');
const cors = require('cors');
const pool = require('./database');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const categoriesRoutes = require('./routes/categories');
const booksRoutes = require('./routes/books');
const copiesRoutes = require('./routes/copies');
const borrowRequestsRoutes = require('./routes/borrowRequests');
const loansRoutes = require('./routes/loans');
const statisticsRoutes = require('./routes/statistics');
const searchRoutes = require('./routes/search');

const { authenticate, authorize } = require('./middleware/auth');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/books', booksRoutes);
app.use('/api/copies', copiesRoutes);
app.use('/api/borrow-requests', borrowRequestsRoutes);
app.use('/api/loans', loansRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/search', searchRoutes);

app.get('/', (req, res) => {
    res.send('Backend quản lý thư viện đang hoạt động');
});

app.get('/api/test', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');

        res.json({
            message: 'Kết nối PostgreSQL thành công',
            time: result.rows[0].now
        });

    } catch (error) {
        res.status(500).json({
            message: 'Kết nối cơ sở dữ liệu thất bại'
        });
    }
});

app.get('/api/auth/me', authenticate, (req, res) => {
    res.json(req.user);
});

app.get('/api/admin/test',
    authenticate,
    authorize('super_admin', 'librarian'),
    (req, res) => {
        res.json({
            message: 'Truy cập Admin thành công',
            user: req.user
        });
    }
);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
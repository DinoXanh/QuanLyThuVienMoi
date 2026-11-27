const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../database');

const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(authorize('super_admin', 'librarian'));

router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, username, full_name, mssv,
                    class_name, role, is_active, created_at
             FROM users
             WHERE ($1 = 'super_admin' OR role = 'reader')
             ORDER BY id ASC`,
            [req.user.role]
        );

        res.json(result.rows);

    } catch (error) {
        console.error(error.message);

        res.status(500).json({
            message: 'Không thể lấy danh sách tài khoản'
        });
    }
});

router.post('/', async (req, res) => {
    try {
        const {
            username,
            password,
            full_name,
            mssv,
            class_name,
            role = 'reader'
        } = req.body || {};

        if (
            typeof username !== 'string' ||
            typeof password !== 'string' ||
            typeof full_name !== 'string' ||
            !username.trim() ||
            !full_name.trim() ||
            password.length < 12 ||
            Buffer.byteLength(password, 'utf8') > 72
        ) {
            return res.status(400).json({
                message: 'Thông tin tài khoản không hợp lệ'
            });
        }

        if (!['librarian', 'reader'].includes(role)) {
            return res.status(400).json({
                message: 'Quyền hạn không hợp lệ'
            });
        }

        if (role === 'librarian' &&
            req.user.role !== 'super_admin') {
            return res.status(403).json({
                message: 'Bạn không có quyền tạo nhân viên'
            });
        }

        if (role === 'reader' && (
            typeof mssv !== 'string' ||
            typeof class_name !== 'string' ||
            !mssv.trim() ||
            !class_name.trim()
        )) {
            return res.status(400).json({
                message: 'Vui lòng nhập MSSV và lớp'
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = await pool.query(
            `INSERT INTO users
            (username, password_hash, full_name,
             mssv, class_name, role)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, username, full_name,
                      mssv, class_name, role, is_active`,
            [
                username.trim(),
                passwordHash,
                full_name.trim(),
                role === 'reader' ? mssv.trim() : null,
                role === 'reader' ? class_name.trim() : null,
                role
            ]
        );

        res.status(201).json({
            message: 'Tạo tài khoản thành công',
            user: result.rows[0]
        });

    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({
                message: 'Tên đăng nhập hoặc MSSV đã tồn tại'
            });
        }

        if (error.code === '22001') {
            return res.status(400).json({
                message: 'Thông tin vượt quá độ dài cho phép'
            });
        }

        console.error(error.message);

        res.status(500).json({
            message: 'Không thể tạo tài khoản'
        });
    }
});

router.patch('/:id/password', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { password } = req.body || {};

        if (
            !Number.isInteger(id) ||
            id <= 0 ||
            typeof password !== 'string' ||
            password.length < 12 ||
            Buffer.byteLength(password, 'utf8') > 72
        ) {
            return res.status(400).json({
                message: 'Dữ liệu hoặc mật khẩu không hợp lệ'
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = await pool.query(
            `UPDATE users
             SET password_hash = $1,
                 token_version = token_version + 1
             WHERE id = $2
             AND role <> 'super_admin'
             AND ($3 = 'super_admin' OR role = 'reader')
             RETURNING id, username, full_name, role`,
            [passwordHash, id, req.user.role]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                message: 'Không tìm thấy tài khoản hoặc không có quyền'
            });
        }

        res.json({
            message: 'Đặt lại mật khẩu thành công',
            user: result.rows[0]
        });

    } catch (error) {
        console.error(error.message);

        res.status(500).json({
            message: 'Không thể đặt lại mật khẩu'
        });
    }
});

module.exports = router;

router.patch('/:id/status', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { is_active } = req.body || {};

        if (!Number.isInteger(id) || id <= 0 ||
            typeof is_active !== 'boolean') {
            return res.status(400).json({
                message: 'Dữ liệu không hợp lệ'
            });
        }

        if (id === req.user.id) {
            return res.status(400).json({
                message: 'Không thể khóa chính tài khoản của mình'
            });
        }

        const result = await pool.query(
            `UPDATE users
             SET is_active = $1,
                 token_version = token_version + CASE
                     WHEN $1 = false THEN 1
                     ELSE 0
                 END
             WHERE id = $2
             AND role <> 'super_admin'
             AND ($3 = 'super_admin' OR role = 'reader')
             RETURNING id, username, full_name, role, is_active`,
            [is_active, id, req.user.role]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                message: 'Không tìm thấy tài khoản hoặc không có quyền'
            });
        }

        res.json({
            message: is_active
                ? 'Mở khóa tài khoản thành công'
                : 'Khóa tài khoản thành công',
            user: result.rows[0]
        });

    } catch (error) {
        console.error(error.message);

        res.status(500).json({
            message: 'Không thể cập nhật trạng thái tài khoản'
        });
    }
});
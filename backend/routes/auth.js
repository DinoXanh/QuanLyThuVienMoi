const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../database');

const router = express.Router();

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body || {};

        if (typeof username !== 'string' ||
            typeof password !== 'string' ||
            !username.trim() || !password) {
            return res.status(400).json({
                message: 'Vui lòng nhập tài khoản và mật khẩu'
            });
        }

        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1',
            [username.trim()]
        );

        const user = result.rows[0];

        if (!user || !user.is_active ||
            !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({
                message: 'Tài khoản hoặc mật khẩu không hợp lệ'
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                role: user.role,
                token_version: user.token_version
            },
            process.env.JWT_SECRET,
            {
                algorithm: 'HS256',
                expiresIn: process.env.JWT_EXPIRES_IN || '8h'
            }
        );

        res.json({
            message: 'Đăng nhập thành công',
            token,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.role
            }
        });

    } catch (error) {
        console.error(error.message);

        res.status(500).json({
            message: 'Lỗi máy chủ'
        });
    }
});

router.post('/register', async (req, res) => {
    try {
        const { username, password, full_name, mssv, class_name } = req.body || {};

        if (
            typeof username !== 'string' ||
            typeof password !== 'string' ||
            typeof full_name !== 'string' ||
            !username.trim() ||
            !password ||
            !full_name.trim()
        ) {
            return res.status(400).json({
                message: 'Vui lòng nhập đầy đủ tên đăng nhập, họ tên và mật khẩu'
            });
        }

        const trimmedUser = username.trim();
        const trimmedFullName = full_name.trim();

        if (trimmedUser.length < 3 || trimmedUser.length > 50) {
            return res.status(400).json({
                message: 'Tên đăng nhập phải từ 3 đến 50 ký tự'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: 'Mật khẩu phải có ít nhất 6 ký tự'
            });
        }

        if (Buffer.byteLength(password, 'utf8') > 72) {
            return res.status(400).json({
                message: 'Mật khẩu không được vượt quá 72 bytes'
            });
        }

        // Kiểm tra xem tên đăng nhập đã tồn tại chưa
        const existing = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [trimmedUser]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                message: 'Tên đăng nhập này đã được sử dụng. Vui lòng chọn tên khác.'
            });
        }

        // Băm mật khẩu bằng Bcrypt
        const passwordHash = await bcrypt.hash(password, 10);

        // Lưu tài khoản mới với vai trò mặc định là 'reader' (độc giả)
        const result = await pool.query(
            `INSERT INTO users (username, password_hash, full_name, mssv, class_name, role)
             VALUES ($1, $2, $3, $4, $5, 'reader')
             RETURNING id, username, full_name, mssv, class_name, role, created_at`,
            [
                trimmedUser,
                passwordHash,
                trimmedFullName,
                mssv && typeof mssv === 'string' && mssv.trim() ? mssv.trim() : null,
                class_name && typeof class_name === 'string' && class_name.trim() ? class_name.trim() : null
            ]
        );

        const newUser = result.rows[0];

        res.status(201).json({
            message: 'Đăng ký tài khoản độc giả thành công! Vui lòng đăng nhập.',
            user: {
                id: newUser.id,
                username: newUser.username,
                full_name: newUser.full_name,
                role: newUser.role
            }
        });

    } catch (error) {
        console.error('Register error:', error.message);

        // Bắt lỗi trùng khóa unique nếu có tranh chấp đồng thời
        if (error.code === '23505') {
            return res.status(409).json({
                message: 'Tên đăng nhập hoặc MSSV đã tồn tại trong hệ thống'
            });
        }

        res.status(500).json({
            message: 'Lỗi máy chủ khi đăng ký tài khoản'
        });
    }
});

module.exports = router;
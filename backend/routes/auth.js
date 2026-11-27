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

module.exports = router;
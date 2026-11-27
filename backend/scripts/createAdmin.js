require('dotenv').config();

const bcrypt = require('bcrypt');
const pool = require('../database');

async function createAdmin() {
    try {
        const username = process.env.ADMIN_USERNAME;
        const password = process.env.ADMIN_PASSWORD;

        if (!username || !password || password.length < 12) {
            throw new Error('Thông tin Admin không hợp lệ');
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = await pool.query(
            `INSERT INTO users
            (username, password_hash, full_name, role)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (username) DO NOTHING
            RETURNING id, username, role`,
            [username, passwordHash, 'Quản trị viên', 'super_admin']
        );

        if (result.rowCount === 0) {
            console.log('Tên tài khoản đã tồn tại');
            return;
        }

        console.log('Tạo Super Admin thành công');
        console.log(result.rows[0]);

    } catch (error) {
        console.error('Lỗi:', error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

createAdmin();
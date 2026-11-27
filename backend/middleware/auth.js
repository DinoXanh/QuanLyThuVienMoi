const jwt = require('jsonwebtoken');
const pool = require('../database');

async function authenticate(req, res, next) {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({
            message: 'Bạn chưa đăng nhập'
        });
    }

    let decoded;

    try {
        decoded = jwt.verify(
            header.split(' ')[1],
            process.env.JWT_SECRET,
            { algorithms: ['HS256'] }
        );
    } catch {
        return res.status(401).json({
            message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn'
        });
    }

    try {
        const result = await pool.query(
            `SELECT id, username, full_name, role,
                    is_active, token_version
             FROM users WHERE id = $1`,
            [decoded.id]
        );

        const user = result.rows[0];

        if (!user || !user.is_active) {
            return res.status(401).json({
                message: 'Tài khoản không khả dụng'
            });
        }

        if (decoded.token_version !== user.token_version) {
            return res.status(401).json({
                message: 'Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại'
            });
        }

        req.user = user;
        next();

    } catch (error) {
        console.error(error.message);

        res.status(500).json({
            message: 'Lỗi máy chủ'
        });
    }
}

function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                message: 'Bạn không có quyền truy cập'
            });
        }

        next();
    };
}

module.exports = { authenticate, authorize };
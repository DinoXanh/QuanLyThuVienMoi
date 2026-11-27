const express = require('express');
const pool = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate,
    authorize('super_admin', 'librarian'),
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT
                    (SELECT COUNT(*)::int
                     FROM books) AS total_books,

                    (SELECT COUNT(*)::int
                     FROM categories) AS total_categories,

                    (SELECT COUNT(*)::int
                     FROM book_copies) AS total_copies,

                    (SELECT COUNT(*)::int
                     FROM book_copies
                     WHERE status = 'available') AS available_copies,

                    (SELECT COUNT(*)::int
                     FROM book_copies
                     WHERE status = 'on_loan') AS borrowed_copies,

                    (SELECT COUNT(*)::int
                     FROM loan_items
                     WHERE status = 'returned') AS returned_books,

                    (SELECT COUNT(*)::int
                     FROM users
                     WHERE role = 'reader') AS total_readers,

                    (SELECT COUNT(*)::int
                     FROM users
                     WHERE role = 'reader'
                     AND is_active = true) AS active_readers,

                    (SELECT COUNT(*)::int
                     FROM users
                     WHERE role IN ('super_admin', 'librarian'))
                     AS total_admins,

                    (SELECT COUNT(*)::int
                     FROM borrow_requests
                     WHERE status = 'pending') AS pending_requests,

                    (SELECT COUNT(*)::int
                     FROM borrow_requests
                     WHERE status = 'approved') AS approved_requests,

                    (SELECT COUNT(*)::int
                     FROM borrow_requests
                     WHERE status = 'rejected') AS rejected_requests,

                    (SELECT COUNT(*)::int
                     FROM borrow_requests
                     WHERE status = 'cancelled') AS cancelled_requests,

                    (SELECT COUNT(*)::int
                     FROM loans
                     WHERE status = 'active') AS active_loans,

                    (SELECT COUNT(*)::int
                     FROM loans
                     WHERE status = 'returned') AS returned_loans,

                    (SELECT COUNT(*)::int
                     FROM loans
                     WHERE status = 'active'
                     AND due_date < CURRENT_TIMESTAMP)
                     AS overdue_loans,

                    (SELECT COUNT(li.id)::int
                     FROM loan_items li
                     JOIN loans l ON li.loan_id = l.id
                     WHERE li.status = 'borrowed'
                     AND l.status = 'active'
                     AND l.due_date < CURRENT_TIMESTAMP)
                     AS overdue_books
            `);

            const statistics = result.rows[0];

            res.json({
                ...statistics,
                max_capacity: 100,
                remaining_capacity: 100 - statistics.total_copies,
                capacity_percentage: statistics.total_copies
            });

        } catch (error) {
            console.error(error.message);

            res.status(500).json({
                message: 'Lỗi máy chủ'
            });
        }
    }
);

router.get('/advanced', authenticate,
    authorize('super_admin', 'librarian'),
    async (req, res) => {
        try {
            const popularBooks = await pool.query(`
                SELECT
                    b.id,
                    b.title,
                    b.author,
                    COUNT(li.id)::int AS total_borrows
                FROM books b
                JOIN book_copies bc ON b.id = bc.book_id
                JOIN loan_items li ON bc.id = li.copy_id
                GROUP BY b.id
                ORDER BY total_borrows DESC, b.id ASC
                LIMIT 5
            `);

            const categoryStatistics = await pool.query(`
                SELECT
                    c.id,
                    c.name,

                    COUNT(DISTINCT b.id)::int AS total_books,

                    COUNT(bc.id)::int AS total_copies,

                    COUNT(bc.id) FILTER (
                        WHERE bc.status = 'available'
                    )::int AS available_copies,

                    COUNT(bc.id) FILTER (
                        WHERE bc.status = 'on_loan'
                    )::int AS borrowed_copies

                FROM categories c

                LEFT JOIN book_categories bcat
                    ON c.id = bcat.category_id

                LEFT JOIN books b
                    ON bcat.book_id = b.id

                LEFT JOIN book_copies bc
                    ON b.id = bc.book_id

                GROUP BY c.id

                ORDER BY total_copies DESC, c.name
            `);

            const monthlyStatistics = await pool.query(`
                WITH months AS (
                    SELECT generate_series(
                        date_trunc('month', CURRENT_DATE)
                            - INTERVAL '5 months',
                        date_trunc('month', CURRENT_DATE),
                        INTERVAL '1 month'
                    ) AS month
                )

                SELECT
                    TO_CHAR(m.month, 'MM/YYYY') AS month,

                    (
                        SELECT COUNT(li.id)::int
                        FROM loan_items li
                        JOIN loans l ON li.loan_id = l.id
                        WHERE l.borrow_date >= m.month
                        AND l.borrow_date <
                            m.month + INTERVAL '1 month'
                    ) AS borrowed_books,

                    (
                        SELECT COUNT(li.id)::int
                        FROM loan_items li
                        WHERE li.status = 'returned'
                        AND li.return_date >= m.month
                        AND li.return_date <
                            m.month + INTERVAL '1 month'
                    ) AS returned_books

                FROM months m
                ORDER BY m.month ASC
            `);

            res.json({
                popular_books: popularBooks.rows,
                category_statistics: categoryStatistics.rows,
                monthly_statistics: monthlyStatistics.rows
            });

        } catch (error) {
            console.error(error.message);

            res.status(500).json({
                message: 'Lỗi máy chủ'
            });
        }
    }
);

module.exports = router;
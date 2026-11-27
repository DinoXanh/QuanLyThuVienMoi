BEGIN;

CREATE TABLE IF NOT EXISTS book_categories (
    book_id INT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    category_id INT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    PRIMARY KEY (book_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_book_categories_category_id
ON book_categories(category_id);

INSERT INTO book_categories (book_id, category_id)
SELECT id, category_id
FROM books
WHERE category_id IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    mssv VARCHAR(20) UNIQUE,
    class_name VARCHAR(50),
    role VARCHAR(20) NOT NULL DEFAULT 'reader'
        CHECK (role IN ('super_admin', 'librarian', 'reader')),
    is_active BOOLEAN DEFAULT TRUE,
    token_version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE books (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(150) NOT NULL,
    category_id INT REFERENCES categories(id),
    publisher VARCHAR(150),
    publication_year INT,
    description TEXT,
    cover_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE book_copies (
    id SERIAL PRIMARY KEY,
    book_id INT NOT NULL REFERENCES books(id),
    copy_code VARCHAR(30) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'on_loan'))
);

CREATE TABLE borrow_requests (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending', 'approved', 'rejected', 'cancelled'
        )),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by INT REFERENCES users(id),
    reviewed_at TIMESTAMP,
    rejection_reason TEXT
);

CREATE TABLE borrow_request_items (
    id SERIAL PRIMARY KEY,
    request_id INT NOT NULL REFERENCES borrow_requests(id),
    book_id INT NOT NULL REFERENCES books(id),
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    UNIQUE (request_id, book_id)
);

CREATE TABLE loans (
    id SERIAL PRIMARY KEY,
    request_id INT UNIQUE NOT NULL REFERENCES borrow_requests(id),
    user_id INT NOT NULL REFERENCES users(id),
    approved_by INT NOT NULL REFERENCES users(id),
    borrow_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP NOT NULL,
    return_date TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'returned'))
);

CREATE TABLE loan_items (
    id SERIAL PRIMARY KEY,
    loan_id INT NOT NULL REFERENCES loans(id),
    copy_id INT NOT NULL REFERENCES book_copies(id),
    return_date TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'borrowed'
        CHECK (status IN ('borrowed', 'returned')),
    UNIQUE (loan_id, copy_id)
);

CREATE UNIQUE INDEX unique_active_copy
ON loan_items(copy_id)
WHERE status = 'borrowed';

CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE book_embeddings (
    book_id INT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
    embedding VECTOR(384),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE library_capacity (
    id INT PRIMARY KEY CHECK (id = 1),
    total_copies INT NOT NULL DEFAULT 0
        CHECK (total_copies BETWEEN 0 AND 100)
);

INSERT INTO library_capacity (id, total_copies)
VALUES (1, 0);

CREATE FUNCTION update_library_capacity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE library_capacity
        SET total_copies = total_copies + 1
        WHERE id = 1;
        RETURN NEW;
    ELSE
        UPDATE library_capacity
        SET total_copies = total_copies - 1
        WHERE id = 1;
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER manage_library_capacity
AFTER INSERT OR DELETE ON book_copies
FOR EACH ROW
EXECUTE FUNCTION update_library_capacity();

COMMIT;
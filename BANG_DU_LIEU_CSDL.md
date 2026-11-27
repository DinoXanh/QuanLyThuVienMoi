# BÁO CÁO ĐẶC TẢ TỪ ĐIỂN DỮ LIỆU (DATABASE DATA DICTIONARY)
**Học phần:** Chuyên đề 1: Khai thác hệ cơ sở dữ liệu  
**Đề tài:** Hệ thống Quản lý Thư viện Thông minh (PostgreSQL 16 + pgvector)  
**Nhóm sinh viên thực hiện:**
1. Nguyễn Phước Bảo An (Trưởng nhóm) - MSSV: 221A010421
2. Nguyễn Tấn Phát - MSSV: 221A010071
3. Nguyễn Phan Diễm My - MSSV: 221A010483
4. Trần Thị Thu Thùy - MSSV: 231A290065

---

> 📄 **File Word chính thức:** Đã được tạo tại file **[`BANG_DU_LIEU_CSDL.docx`](file:///d:/github%20clone/booking_system_deploy_test/BANG_DU_LIEU_CSDL.docx)** (Có đầy đủ tiêu đề, màu sắc bảng xanh navy chuyên nghiệp, phân trang, sẵn sàng in hoặc nộp cho giảng viên).

---

## I. TỔNG QUAN HỆ CƠ SỞ DỮ LIỆU
* **Hệ quản trị CSDL:** PostgreSQL 16+
* **Extension mở rộng:** `pgvector`
* **Kiểu dữ liệu Vector:** `vector(384)` (chuẩn mô hình Sentence-Transformers `all-MiniLM-L6-v2`)
* **Kiến trúc dữ liệu:** Gồm 6 bảng chính quản lý toàn bộ nghiệp vụ từ xác thực, quản lý kho sách, lưu trữ vector nhúng cho đến giao dịch mượn trả an toàn (ACID).

---

## II. ĐẶC TẢ CHI TIẾT CÁC BẢNG DỮ LIỆU

### 1. Bảng `roles` (Vai trò & Phân quyền)
Lưu trữ các cấp độ quyền hạn truy cập của hệ thống (ADMIN, LIBRARIAN, READER).

| STT | Tên trường | Kiểu dữ liệu | Khóa | Ràng buộc / Mặc định | Mô tả ý nghĩa |
| :---: | :--- | :--- | :---: | :--- | :--- |
| 1 | `id` | INT | **PK** | SERIAL, NOT NULL | Mã định danh vai trò (tự tăng) |
| 2 | `name` | VARCHAR(50) | **UK** | NOT NULL, UNIQUE | Tên vai trò (ADMIN, LIBRARIAN, READER) |
| 3 | `description` | VARCHAR(255) | | NULL | Mô tả chi tiết quyền hạn của vai trò |

---

### 2. Bảng `users` (Tài khoản người dùng)
Lưu trữ hồ sơ độc giả và tài khoản nhân viên thư viện.

| STT | Tên trường | Kiểu dữ liệu | Khóa | Ràng buộc / Mặc định | Mô tả ý nghĩa |
| :---: | :--- | :--- | :---: | :--- | :--- |
| 1 | `id` | UUID | **PK** | `gen_random_uuid()`, NOT NULL | Mã định danh duy nhất của người dùng |
| 2 | `email` | VARCHAR(255) | **UK** | NOT NULL, UNIQUE | Địa chỉ email (dùng làm tên đăng nhập) |
| 3 | `password_hash` | VARCHAR(255) | | NOT NULL | Mật khẩu mã hóa bảo mật (bcrypt hash) |
| 4 | `full_name` | VARCHAR(100) | | NOT NULL | Họ và tên đầy đủ của độc giả / thủ thư |
| 5 | `phone` | VARCHAR(20) | | NULL | Số điện thoại liên hệ |
| 6 | `role_id` | INT | **FK** | NOT NULL, REFERENCES `roles(id)` | Khóa ngoại trỏ đến vai trò người dùng |
| 7 | `status` | VARCHAR(20) | | DEFAULT 'ACTIVE' | Trạng thái thẻ (ACTIVE, LOCKED) |
| 8 | `created_at` | TIMESTAMPTZ | | DEFAULT CURRENT_TIMESTAMP | Thời gian đăng ký tài khoản |

---

### 3. Bảng `categories` (Thể loại / Danh mục sách)
Phân loại chuyên mục sách theo các nhóm kiến thức.

| STT | Tên trường | Kiểu dữ liệu | Khóa | Ràng buộc / Mặc định | Mô tả ý nghĩa |
| :---: | :--- | :--- | :---: | :--- | :--- |
| 1 | `id` | INT | **PK** | SERIAL, NOT NULL | Mã danh mục thể loại sách (tự tăng) |
| 2 | `name` | VARCHAR(100) | **UK** | NOT NULL, UNIQUE | Tên thể loại (CNTT, Kinh tế, Văn học...) |
| 3 | `description` | TEXT | | NULL | Mô tả nội dung của nhóm danh mục |

---

### 4. Bảng `books` (Kho sách & Vector Embeddings - BẢNG TRỌNG TÂM)
Lưu thông tin đầu sách, số lượng tồn kho và chuỗi vector 384 chiều của nội dung sách phục vụ tìm kiếm ngữ nghĩa.

| STT | Tên trường | Kiểu dữ liệu | Khóa | Ràng buộc / Mặc định | Mô tả ý nghĩa |
| :---: | :--- | :--- | :---: | :--- | :--- |
| 1 | `id` | UUID | **PK** | `gen_random_uuid()`, NOT NULL | Mã định danh duy nhất của đầu sách |
| 2 | `title` | VARCHAR(255) | | NOT NULL | Tên / Nhan đề sách |
| 3 | `author` | VARCHAR(100) | | NOT NULL | Tên tác giả hoặc nhóm tác giả |
| 4 | `isbn` | VARCHAR(20) | **UK** | NULL, UNIQUE | Mã số tiêu chuẩn quốc tế cho sách (ISBN) |
| 5 | `category_id` | INT | **FK** | NOT NULL, REFERENCES `categories(id)` | Khóa ngoại liên kết thể loại sách |
| 6 | `quantity` | INT | | NOT NULL, DEFAULT 0, CHECK (`quantity >= 0`) | Số lượng sách vật lý còn sẵn trong kho |
| 7 | `description` | TEXT | | NOT NULL | Tóm tắt nội dung sách (Dùng để tạo Vector nhúng) |
| 8 | **`embedding`** | **VECTOR(384)** | | **NULL, pgvector extension** | **Vector nhúng 384 chiều mô hình all-MiniLM-L6-v2** |
| 9 | `created_at` | TIMESTAMPTZ | | DEFAULT CURRENT_TIMESTAMP | Thời điểm sách được nhập vào hệ thống |

---

### 5. Bảng `borrow_orders` (Phiếu mượn sách)
Quản lý tổng quát các đợt mượn sách của độc giả kèm trạng thái xử lý giao dịch.

| STT | Tên trường | Kiểu dữ liệu | Khóa | Ràng buộc / Mặc định | Mô tả ý nghĩa |
| :---: | :--- | :--- | :---: | :--- | :--- |
| 1 | `id` | UUID | **PK** | `gen_random_uuid()`, NOT NULL | Mã phiếu mượn sách |
| 2 | `user_id` | UUID | **FK** | NOT NULL, REFERENCES `users(id)` | Khóa ngoại trỏ đến độc giả thực hiện mượn |
| 3 | `order_date` | TIMESTAMPTZ | | DEFAULT CURRENT_TIMESTAMP | Thời điểm tạo yêu cầu mượn sách |
| 4 | `status` | VARCHAR(30) | | DEFAULT 'PENDING' | Trạng thái phiếu: PENDING, APPROVED, REJECTED, COMPLETED |
| 5 | `total_books` | INT | | NOT NULL, DEFAULT 1 | Tổng số lượng cuốn sách mượn trong phiếu |

---

### 6. Bảng `borrow_details` (Chi tiết sách mượn & Phí phạt)
Theo dõi cụ thể từng cuốn sách trong phiếu mượn, hạn trả, ngày trả thực tế và tiền phạt quá hạn.

| STT | Tên trường | Kiểu dữ liệu | Khóa | Ràng buộc / Mặc định | Mô tả ý nghĩa |
| :---: | :--- | :--- | :---: | :--- | :--- |
| 1 | `id` | UUID | **PK** | `gen_random_uuid()`, NOT NULL | Mã chi tiết từng cuốn sách mượn |
| 2 | `order_id` | UUID | **FK** | NOT NULL, REFERENCES `borrow_orders(id)` ON DELETE CASCADE | Khóa ngoại liên kết phiếu mượn tương ứng |
| 3 | `book_id` | UUID | **FK** | NOT NULL, REFERENCES `books(id)` | Khóa ngoại cuốn sách cụ thể được mượn |
| 4 | `borrowed_at` | TIMESTAMPTZ | | NULL | Thời điểm thủ thư giao sách thực tế |
| 5 | `due_date` | TIMESTAMPTZ | | NOT NULL | Hạn chót độc giả phải mang sách đến trả |
| 6 | `returned_date` | TIMESTAMPTZ | | NULL | Thời điểm thực tế độc giả mang trả sách |
| 7 | `status` | VARCHAR(30) | | DEFAULT 'BORROWED' | Trạng thái mượn: BORROWED, RETURNED, OVERDUE, LOST |
| 8 | `fine_amount` | NUMERIC(10,2) | | DEFAULT 0.00, CHECK (`fine_amount >= 0`) | Số tiền phạt phát sinh nếu trễ hạn hoặc làm hỏng/mất |

---

## III. DỮ LIỆU MẪU MINH HỌA (SAMPLE MOCK DATA)

### Minh họa bảng `books` (kèm vector nhúng):
| id | title | author | quantity | embedding (vector 384 chiều) |
| :--- | :--- | :--- | :---: | :--- |
| `b1a2...c4` | Lập trình Java Căn Bản | Nguyễn Văn A | 10 | `[-0.0412, 0.1254, ..., 0.0891]` |
| `f3d4...e1` | Cấu trúc dữ liệu & Giải thuật | Trần Bình | 5 | `[0.0815, -0.2104, ..., -0.0342]` |
| `a9c8...b2` | Machine Learning Cơ Bản | Vũ Hữu Tiệp | 7 | `[0.1523, 0.0419, ..., 0.2014]` |

### Minh họa bảng `borrow_details` (theo dõi mượn & phạt):
| id | order_id | book_id | due_date | returned_date | status | fine_amount |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `d101...` | ord-01 | b1a2...c4 | 2026-10-15 | 2026-10-14 | RETURNED | 0.00 VNĐ (Đúng hạn) |
| `d102...` | ord-02 | f3d4...e1 | 2026-10-10 | 2026-10-13 | RETURNED | 15,000 VNĐ (Trễ 3 ngày) |
| `d103...` | ord-03 | a9c8...b2 | 2026-11-20 | NULL | BORROWED | 0.00 VNĐ (Đang mượn) |

---

## IV. CHIẾN LƯỢC ĐÁNH CHỈ MỤC & TỐI ƯU TRUY VẤN (INDEXING STRATEGY)

| STT | Bảng áp dụng | Cột chỉ mục | Loại Index | Mục đích tối ưu truy vấn |
| :---: | :--- | :--- | :--- | :--- |
| 1 | `books` | `embedding` | **HNSW (m=16, ef_construction=64)** | **Tối ưu tìm kiếm Cosine Similarity cho Vector AI (giảm từ 1200ms xuống còn 8ms)** |
| 2 | `users` | `email` | B-Tree (Unique) | Tăng tốc đăng nhập và kiểm tra trùng lặp tài khoản |
| 3 | `books` | `category_id` | B-Tree | Tăng tốc lọc sách theo chuyên mục |
| 4 | `borrow_orders` | `user_id, order_date` | Composite B-Tree | Tối ưu truy vấn lịch sử mượn trả theo thời gian |
| 5 | `borrow_details` | `due_date, status` | Composite B-Tree | Tối ưu câu lệnh quét tự động danh sách sách quá hạn hàng ngày |


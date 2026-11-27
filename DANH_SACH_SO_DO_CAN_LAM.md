# DANH SÁCH CÁC SƠ ĐỒ CẦN LÀM CHO ĐỒ ÁN
**Học phần:** Chuyên đề 1: Khai thác hệ cơ sở dữ liệu  
**Đề tài:** Hệ thống Quản lý Thư viện Thông minh (Ứng dụng CSDL Vector - Pgvector & Tối ưu hóa Truy vấn)  
**Nhóm sinh viên thực hiện:**
1. Nguyễn Phước Bảo An (Trưởng nhóm) - MSSV: 221A010421
2. Nguyễn Tấn Phát - MSSV: 221A010071
3. Nguyễn Phan Diễm My - MSSV: 221A010483
4. Trần Thị Thu Thùy - MSSV: 231A290065

---

## 📌 BẢNG CHECKLIST TIẾN ĐỘ THỰC HIỆN

| STT | Tên Sơ Đồ | Mức Độ Ưu Tiên | Phân Công Phụ Trách | Trạng Thái |
| :---: | :--- | :---: | :---: | :---: |
| 1 | Sơ đồ Use Case Tổng quát (Overall Use Case) | **Bắt buộc** | Cả nhóm thảo luận | [ ] Chưa làm |
| 2 | Sơ đồ Thực thể Quan hệ Vật lý (Physical ERD) | **Bắt buộc (Trọng tâm)** | Bảo An (Database Lead) | [ ] Chưa làm |
| 3 | Sơ đồ Tuần tự Mượn sách ACID (Sequence Diagram) | **Bắt buộc (Điểm nhấn)** | Diễm My (Backend Logic) | [ ] Chưa làm |
| 4 | Sơ đồ Kiến trúc Hệ thống (System Architecture) | **Quan trọng (Hệ thống)** | Bảo An & Tấn Phát | [ ] Chưa làm |
| 5 | Sơ đồ Luồng Dữ liệu Tạo Vector (Vector Pipeline) | **Điểm nhấn môn CSDL** | Bảo An (AI / Vector) | [ ] Chưa làm |
| 6 | Sơ đồ Hoạt động Tìm kiếm Ngữ nghĩa (Semantic Search) | **Điểm nhấn môn CSDL** | Thu Thùy & Bảo An | [ ] Chưa làm |
| 7 | Sơ đồ Hoạt động Luồng Mượn / Trả (Activity Diagram) | Bổ trợ | Thu Thùy (UI/UX) | [ ] Chưa làm |
| 8 | Sơ đồ Triển khai Hệ thống (Deployment Diagram) | Bổ trợ | Tấn Phát (System/Docker) | [ ] Chưa làm |

---

## 📝 CHI TIẾT NỘI DUNG TỪNG SƠ ĐỒ

### 1. Sơ đồ Use Case Tổng quát (Overall Use Case Diagram)
* **Mục tiêu:** Thể hiện phạm vi chức năng của hệ thống đối với từng nhóm người dùng.
* **Các thành phần bắt buộc:**
  * **Actor Độc giả (Reader/User):** 
    * Đăng ký, đăng nhập tài khoản.
    * Tìm kiếm sách thông minh bằng ngữ nghĩa (Semantic Search).
    * Xem chi tiết sách và gợi ý sách tương đồng.
    * Tạo yêu cầu mượn sách.
    * Theo dõi lịch sử mượn, hạn trả sách và phí phạt (nếu có).
  * **Actor Thủ thư / Quản trị viên (Admin/Librarian):**
    * Quản lý kho sách (Thêm/Sửa/Xóa/Cập nhật số lượng).
    * Duyệt yêu cầu mượn sách, xác nhận trả sách.
    * Quản lý độc giả và xử lý vi phạm.
    * Xem báo cáo thống kê (Top sách mượn, sách quá hạn).
* **Công cụ gợi ý:** Draw.io hoặc PlantUML.

---

### 2. Sơ đồ Thực thể Quan hệ Vật lý (Physical ERD / Database Schema)
* ⭐ **ĐÂY LÀ SƠ ĐỒ QUAN TRỌNG NHẤT CỦA MÔN HỌC.**
* **Mục tiêu:** Định nghĩa chi tiết cấu trúc bảng dưới PostgreSQL, kiểu dữ liệu, ràng buộc khóa chính/khóa ngoại.
* **Các bảng bắt buộc phải có:**
  * `users` (id, email, password, full_name, phone, role_id, created_at...)
  * `roles` (id, name: 'ADMIN', 'USER'...)
  * `categories` (id, name, description)
  * `books` (id, title, author, category_id, isbn, quantity, description, **`embedding vector(384)`**, created_at...)
    * *Lưu ý:* Cột `embedding` là kiểu dữ liệu vector từ extension `pgvector`.
  * `borrow_orders` (id, user_id, order_date, status: 'PENDING', 'APPROVED', 'RETURNED', 'OVERDUE')
  * `borrow_details` (id, order_id, book_id, return_date, fine_amount)
* **Công cụ gợi ý:** Draw.io hoặc DBeaver (DBeaver có tính năng tự vẽ ERD từ Database thật).

---

### 3. Sơ đồ Tuần tự Giao dịch Mượn sách (Sequence Diagram - ACID Transaction)
* **Mục tiêu:** Chứng minh kiến thức về xử lý giao dịch an toàn (tránh tình trạng tranh chấp dữ liệu khi nhiều người cùng mượn cuốn sách cuối cùng).
* **Các đối tượng tương tác:**
  `Độc giả` ➔ `Giao diện Web (Frontend)` ➔ `API Server (Backend)` ➔ `PostgreSQL Database`.
* **Luồng xử lý:**
  1. Frontend gửi yêu cầu: `POST /api/borrow` kèm danh sách `book_id`.
  2. Backend phát lệnh: `BEGIN TRANSACTION`.
  3. DB kiểm tra tồn kho: `SELECT quantity FROM books WHERE id = ... FOR UPDATE`.
  4. Nếu `quantity > 0`:
     * Trừ tồn kho: `UPDATE books SET quantity = quantity - 1`.
     * Tạo bản ghi: `INSERT INTO borrow_orders` & `borrow_details`.
     * Xác nhận: `COMMIT TRANSACTION` ➔ Báo thành công ra màn hình.
  5. Nếu `quantity <= 0`:
     * Hủy thao tác: `ROLLBACK TRANSACTION` ➔ Báo lỗi "Sách đã hết".
* **Công cụ gợi ý:** PlantUML hoặc Mermaid.

---

### 4. Sơ đồ Kiến trúc Hệ thống (System Architecture Diagram)
* **Mục tiêu:** Cho giảng viên thấy toàn cảnh công nghệ và cách các tầng kết nối với nhau.
* **Các tầng kiến trúc:**
  * **Tầng Trình bày (Presentation Layer):** Web Client (ReactJS, Tailwind CSS/Ant Design).
  * **Tầng Ứng dụng (Application Layer):** RESTful API (Node.js / Python FastAPI).
  * **Tầng Xử lý AI (AI Engine):** Mô hình nhúng (Sentence-Transformers `all-MiniLM-L6-v2` / Gemini Embedding).
  * **Tầng Dữ liệu (Data Layer):** PostgreSQL 16 tích hợp extension `pgvector` (Quản lý dữ liệu bảng quan hệ + Chỉ mục vector HNSW).
* **Công cụ gợi ý:** Draw.io.

---

### 5. Sơ đồ Luồng Dữ liệu Tạo Vector (Vector Data Pipeline Flowchart)
* **Mục tiêu:** Mô tả chi tiết cách thức sách được chuyển thành vector lưu trong CSDL.
* **Quy trình:**
  `Thủ thư nhập sách mới`  
  ⬇️  
  `Trích xuất Tóm tắt nội dung (Book Description)`  
  ⬇️  
  `Gửi chuỗi văn bản qua Mô hình Embedding`  
  ⬇️  
  `Sinh vector số thực 384 chiều: [-0.023, 0.451, ..., 0.119]`  
  ⬇️  
  `Thực thi câu lệnh SQL INSERT vào cột embedding của bảng books`  
  ⬇️  
  `Tự động cập nhật chỉ mục Vector (HNSW Index)`
* **Công cụ gợi ý:** Draw.io hoặc Mermaid flowchart.

---

### 6. Sơ đồ Hoạt động Tìm kiếm Ngữ nghĩa (Semantic Search Activity Diagram)
* **Mục tiêu:** Mô tả luồng xử lý từ lúc người dùng gõ câu tìm kiếm đến khi nhận kết quả.
* **Quy trình:**
  1. Người dùng gõ: *"Tìm tài liệu học lập trình hướng đối tượng bằng Java"*.
  2. Hệ thống vector hóa câu truy vấn ➔ `query_vector`.
  3. CSDL chạy câu truy vấn tìm kiếm gần nhất:
     ```sql
     SELECT id, title, description, (1 - (embedding <=> query_vector)) AS similarity
     FROM books
     ORDER BY embedding <=> query_vector
     LIMIT 5;
     ```
  4. Hệ thống lọc ra top 5 sách có độ tương đồng cao nhất.
  5. Trả về và hiển thị danh sách sách tương ứng lên giao diện.
* **Công cụ gợi ý:** Draw.io.

---

### 7. Sơ đồ Hoạt động Luồng Mượn / Trả Sách (Activity Diagram)
* **Mục tiêu:** Mô tả quy trình nghiệp vụ tổng thể mượn trả trong thực tế.
* **Quy trình:**
  * Độc giả chọn sách ➔ Đặt lịch mượn ➔ Trạng thái "Chờ duyệt (PENDING)".
  * Thủ thư kiểm tra sách thực tế ➔ Duyệt yêu cầu "Đã mượn (APPROVED)".
  * Độc giả mang trả sách ➔ Thủ thư kiểm tra ngày trả:
    * Nếu đúng hạn: Đóng phiếu mượn "Đã trả (RETURNED)".
    * Nếu trễ hạn: Tính phí phạt (Phạt = Số ngày trễ × Đơn giá/ngày) ➔ Độc giả đóng phạt ➔ Đóng phiếu mượn.
* **Công cụ gợi ý:** Draw.io.

---

### 8. Sơ đồ Triển khai Hệ thống (Deployment Diagram)
* **Mục tiêu:** Thể hiện cách đóng gói và triển khai ứng dụng trên máy chủ / môi trường thực tế.
* **Thành phần:**
  * **Client Node:** Trình duyệt web máy tính / điện thoại.
  * **App Server Node (Docker):** Chạy ứng dụng Backend Node.js / Python FastAPI trên Port 5000.
  * **Database Server Node (Docker):** Chạy PostgreSQL 16 + pgvector trên Port 5432 (Mount dữ liệu vào Docker Volume để đảm bảo an toàn dữ liệu).
* **Công cụ gợi ý:** Draw.io.

---

## 🛠️ CÔNG CỤ VẼ ĐƯỢC KHUYÊN DÙNG
1. **[Draw.io (diagrams.net)](https://app.diagrams.net/):** Miễn phí 100%, có thể lưu file `.drawio` vào Git để cả nhóm cùng chỉnh sửa.
2. **Mermaid / PlantUML:** Viết bằng mã text, sinh sơ đồ tự động cực nhanh cho Sơ đồ Tuần tự (Sequence) và Luồng (Flowchart).
3. **DBeaver:** Sau khi viết xong code CSDL, dùng DBeaver mở schema lên là có thể chụp ngay ERD thực tế cực kỳ chính xác.


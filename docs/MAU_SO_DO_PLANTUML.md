# MÃ NGUỒN PLANTUML CHO TOÀN BỘ 8 SƠ ĐỒ
**Học phần:** Chuyên đề 1: Khai thác hệ cơ sở dữ liệu  
**Đề tài:** Hệ thống Quản lý Thư viện Thông minh (Vector DB / Pgvector & Tối ưu hóa Truy vấn)

---

## 📌 HƯỚNG DẪN SỬ DỤNG
1. Mở trang web: [plantuml.com/plantuml](https://www.plantuml.com/plantuml)
2. Sao chép từng đoạn mã bên dưới dán vào khung vẽ.
3. Bấm Submit để xem sơ đồ và tải ảnh PNG/SVG về dán vào báo cáo.

---

### 1. SƠ ĐỒ USE CASE TỔNG QUÁT (USE CASE DIAGRAM)
```plantuml
@startuml
title SƠ ĐỒ USE CASE TỔNG QUÁT - HỆ THỐNG QUẢN LÝ THƯ VIỆN THÔNG MINH
left to right direction
skinparam packageStyle rectangle
skinparam shadowing false

actor "Độc giả\n(Reader)" as Reader
actor "Thủ thư / Admin\n(Librarian)" as Admin

rectangle "Hệ Thống Quản Lý Thư Viện" {
    (Đăng ký & Đăng nhập) as UC_Auth
    (Tìm kiếm sách theo ngữ nghĩa\n- AI Semantic Search) as UC_Search
    (Xem chi tiết & Gợi ý sách tương tự) as UC_Recommend
    (Đặt lịch mượn sách) as UC_Borrow
    (Xem lịch sử mượn & Hạn trả) as UC_History

    (Quản lý danh mục & Kho sách) as UC_ManageBooks
    (Duyệt yêu cầu mượn sách) as UC_ApproveBorrow
    (Xác nhận trả sách & Xử lý phạt) as UC_ReturnBook
    (Quản lý độc giả & Khóa thẻ) as UC_ManageUsers
    (Xem báo cáo & Thống kê mượn trả) as UC_Stats

    UC_Search ..> UC_Recommend : <<include>>
    UC_ReturnBook ..> UC_Stats : <<extend>>
}

Reader --> UC_Auth
Reader --> UC_Search
Reader --> UC_Recommend
Reader --> UC_Borrow
Reader --> UC_History

Admin --> UC_Auth
Admin --> UC_ManageBooks
Admin --> UC_ApproveBorrow
Admin --> UC_ReturnBook
Admin --> UC_ManageUsers
Admin --> UC_Stats
@enduml
```

---

### 2. SƠ ĐỒ THỰC THỂ QUAN HỆ VẬT LÝ (PHYSICAL ERD)
```plantuml
@startuml
title SƠ ĐỒ THỰC THỂ QUAN HỆ VẬT LÝ (POSTGRESQL + PGVECTOR)
hide empty methods
hide empty fields
skinparam roundcorner 5
skinparam linetype ortho
skinparam shadowing false

entity "roles" as roles {
    * id : int <<PK>>
    --
    name : varchar(50) <<UK>>
    description : varchar(255)
}

entity "users" as users {
    * id : int <<PK>>
    --
    username : varchar(50) <<UK>>
    password_hash : varchar(255)
    full_name : varchar(100)
    mssv : varchar(20) <<UK>>
    class_name : varchar(50)
    * role_id : int <<FK>>
    is_active : boolean
    created_at : timestamp
}

entity "categories" as categories {
    * id : int <<PK>>
    --
    name : varchar(100) <<UK>>
    description : text
}

entity "books" as books {
    * id : int <<PK>>
    --
    title : varchar(255)
    author : varchar(150)
    isbn : varchar(20) <<UK>>
    * category_id : int <<FK>>
    quantity : int
    description : text
    embedding : vector(384) <<pgvector>>
    created_at : timestamp
}

entity "borrow_orders" as borrow_orders {
    * id : int <<PK>>
    --
    * user_id : int <<FK>>
    order_date : timestamp
    status : varchar(30)
    total_books : int
}

entity "borrow_details" as borrow_details {
    * id : int <<PK>>
    --
    * order_id : int <<FK>>
    * book_id : int <<FK>>
    due_date : timestamp
    returned_date : timestamp
    fine_amount : numeric(10,2)
}

roles ||--o{ users : "assigned_to"
categories ||--o{ books : "classifies"
users ||--o{ borrow_orders : "places"
borrow_orders ||--|{ borrow_details : "contains"
books ||--o{ borrow_details : "referenced_in"
@enduml
```

---

### 3. SƠ ĐỒ TUẦN TỰ GIAO DỊCH MƯỢN SÁCH ACID (SEQUENCE DIAGRAM)
```plantuml
@startuml
title SƠ ĐỒ TUẦN TỰ GIAO DỊCH MƯỢN SÁCH (ACID TRANSACTION)
autonumber
skinparam responseMessageBelowArrow true
skinparam BoxPadding 10
skinparam shadowing false

actor "Độc giả\n(Reader)" as Reader
box "Hệ thống Quản lý Thư viện" #GhostWhite
    participant "Giao diện Web\n(Frontend)" as UI
    participant "Backend API\n(Server)" as API
    database "PostgreSQL\n(pgvector)" as DB
end box

Reader -> UI : Nhấn "Xác nhận mượn sách"
activate UI

UI -> API : POST /api/borrow\n{book_id, user_id}
activate API

note over API, DB #LightYellow
  <b>BẮT ĐẦU GIAO DỊCH CSDL (ACID)</b>
  Bảo đảm không bị xung đột khi nhiều người cùng mượn 1 cuốn
end note

API -> DB : BEGIN TRANSACTION
activate DB

API -> DB : SELECT quantity FROM books\nWHERE id = :book_id FOR UPDATE
note right: Khóa dòng (Row-level Lock)\nngăn các giao dịch khác sửa đổi

DB --> API : Trả về số lượng hiện có (quantity)

alt #LightCyan [quantity > 0 : Còn sách trong kho]
    API -> DB : UPDATE books SET quantity = quantity - 1\nWHERE id = :book_id
    API -> DB : INSERT INTO borrow_orders (...)
    API -> DB : INSERT INTO borrow_details (...)
    API -> DB : COMMIT TRANSACTION
    DB --> API : Giao dịch thành công
    API --> UI : 201 Created (Đặt mượn thành công)
    UI --> Reader : Thông báo thành công & Mã phiếu mượn

else #MistyRose [quantity <= 0 : Hết sách]
    API -> DB : ROLLBACK TRANSACTION
    note right: Hủy bỏ toàn bộ thao tác,\nkhôi phục trạng thái ban đầu
    DB --> API : Đã hủy giao dịch
    deactivate DB
    API --> UI : 400 Bad Request ("Sách hiện tại đã hết")
    deactivate API
    UI --> Reader : Hiển thị thông báo lỗi
    deactivate UI
end
@enduml
```

---

### 4. SƠ ĐỒ KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE DIAGRAM)
```plantuml
@startuml
title SƠ ĐỒ KIẾN TRÚC HỆ THỐNG QUẢN LÝ THƯ VIỆN THÔNG MINH
skinparam componentStyle uml2
skinparam shadowing false
skinparam roundcorner 8

package "Tầng Trình Diễn (Presentation Layer)" {
    [Web Client\n(ReactJS / HTML5-CSS3-JS)] as Client
    [Giao diện Độc giả] as UI_Reader
    [Giao diện Quản trị / Thủ thư] as UI_Admin
    Client ..> UI_Reader
    Client ..> UI_Admin
}

package "Tầng Ứng Dụng (Application Layer)" {
    [API Gateway / Router] as Router
    [Auth Service\n(JWT Token)] as AuthService
    [Library Business Service\n(Transaction Management)] as BizService
    [Semantic Search Service] as SearchService
    
    Router --> AuthService
    Router --> BizService
    Router --> SearchService
}

package "Tầng Xử Lý AI (AI / Embedding Engine)" {
    [Mô hình Nhúng Văn Bản\n(Sentence-Transformers\nall-MiniLM-L6-v2)] as EmbeddingModel
}

package "Tầng Dữ Liệu (Data Layer - PostgreSQL 16)" {
    database "PostgreSQL Core DB" {
        [Bảng Dữ liệu Quan hệ\n(users, books, orders, details)] as RelTables
        [Chỉ mục B-Tree Index\n(Tối ưu truy vấn nghiệp vụ)] as BTreeIndex
    }
    
    database "Extension: pgvector" {
        [Cột lưu trữ Vector\nembedding vector(384)] as VectorCol
        [Chỉ mục HNSW / IVFFlat Index\n(Tối ưu khoảng cách Cosine)] as HNSWIndex
    }
}

Client --> Router : HTTP / RESTful API (JSON)
SearchService --> EmbeddingModel : Gửi chuỗi Text -> Nhận Vector (384 dims)
BizService --> RelTables : SQL Queries (ACID Transaction)
SearchService --> VectorCol : SQL: ORDER BY embedding <=> query_vector
RelTables .. BTreeIndex
VectorCol .. HNSWIndex
@enduml
```

---

### 5. SƠ ĐỒ LUỒNG DỮ LIỆU TẠO VECTOR (VECTOR DATA PIPELINE)
```plantuml
@startuml
title QUY TRÌNH TẠO VÀ LƯU VECTOR EMBEDDING (DATA PIPELINE)
start
skinparam shadowing false

:Thủ thư nhập thông tin sách mới\n(Title, Author, Category, Description, Quantity);
:Hệ thống kiểm tra tính hợp lệ dữ liệu (Validation);

if (Dữ liệu hợp lệ?) then (Có)
    :Trích xuất chuỗi văn bản cần nhúng:\ntext = Title + " - " + Description;
    :Gửi chuỗi text đến Mô hình Embedding\n(Sentence-Transformers all-MiniLM-L6-v2);
    :Mô hình tính toán và sinh chuỗi Vector 384 chiều\n[0.0124, -0.4512, ..., 0.1089];
    :Chuẩn bị câu lệnh SQL INSERT:\nINSERT INTO books(title, author, description, quantity, embedding)\nVALUES (..., '[0.0124, -0.4512, ...]');
    :Thực thi lưu bản ghi vào CSDL PostgreSQL;
    :PostgreSQL tự động cập nhật Vector vào\nChỉ mục HNSW (Hierarchical Navigable Small World);
    :Thông báo "Thêm sách và tạo Vector thành công";
    stop
else (Không)
    :Báo lỗi dữ liệu không hợp lệ cho Thủ thư;
    stop
endif
@enduml
```

---

### 6. SƠ ĐỒ HOẠT ĐỘNG TÌM KIẾM NGỮ NGHĨA (SEMANTIC SEARCH)
```plantuml
@startuml
title SƠ ĐỒ HOẠT ĐỘNG TÌM KIẾM SÁCH THEO NGỮ NGHĨA (SEMANTIC SEARCH)
skinparam shadowing false

|Độc giả (Web UI)|
start
:Nhập câu tìm kiếm bằng ngôn ngữ tự nhiên\n(VD: "Tài liệu học lập trình hướng đối tượng bằng Java");
:Bấm nút "Tìm kiếm AI";
:Gửi request: GET /api/books/search?q=...;

|Backend API|
:Tiếp nhận chuỗi truy vấn (query_text);
:Gửi chuỗi sang Mô hình Embedding;

|Mô hình AI Embedding|
:Chuyển đổi chuỗi query_text\nthành Query Vector 384 chiều;
:Trả về Query Vector cho Backend;

|Backend API|
:Tạo câu lệnh SQL tìm kiếm gần nhất bằng khoảng cách Cosine:\nSELECT id, title, description,\n       (1 - (embedding <=> query_vector)) AS similarity\nFROM books\nORDER BY embedding <=> query_vector\nLIMIT 5;
:Gửi câu lệnh SQL đến PostgreSQL;

|PostgreSQL (pgvector)|
:Quét chỉ mục HNSW trên cột embedding;
:Tính khoảng cách Cosine (<=>) với Query Vector;
:Lấy ra Top 5 cuốn sách có khoảng cách gần nhất;
:Trả kết quả bảng dữ liệu cho Backend;

|Backend API|
:Đóng gói dữ liệu thành chuẩn JSON (kèm điểm độ tương đồng similarity);
:Trả về Response 200 OK cho Web UI;

|Độc giả (Web UI)|
:Hiển thị danh sách 5 cuốn sách tương đồng nhất\nkèm thẻ điểm % liên quan;
stop
@enduml
```

---

### 7. SƠ ĐỒ HOẠT ĐỘNG LUỒNG MƯỢN / TRẢ SÁCH (ACTIVITY DIAGRAM)
```plantuml
@startuml
title QUY TRÌNH NGHIỆP VỤ MƯỢN VÀ TRẢ SÁCH TỔNG THỂ
skinparam shadowing false

|Độc giả (Reader)|
start
:Tìm sách và chọn "Đặt mượn sách";

|Hệ thống Thư viện|
:Tạo phiếu mượn ở trạng thái "Chờ duyệt" (PENDING);
:Gửi thông báo xác nhận lịch hẹn nhận sách;

|Thủ thư (Librarian)|
:Độc giả đến thư viện xuất trình mã phiếu;
:Thủ thư kiểm tra sách thực tế trong kho;
if (Sách sẵn sàng?) then (Đồng ý)
    :Duyệt phiếu mượn (Trạng thái: APPROVED);
    :Giao sách vật lý cho Độc giả;
    :Hệ thống tự động ghi nhận ngày hẹn trả (Due Date);
else (Từ chối)
    :Hủy phiếu mượn và thông báo lý do;
    stop
endif

|Độc giả (Reader)|
:Sử dụng sách mượn;
:Mang sách đến quầy trả sách;

|Thủ thư (Librarian)|
:Tiếp nhận sách và quét mã vạch phiếu mượn;

|Hệ thống Thư viện|
if (Ngày trả <= Ngày hẹn trả?) then (Đúng hạn)
    :Cập nhật trạng thái phiếu: "ĐÃ TRẢ" (RETURNED);
    :Cập nhật số lượng sách tồn kho: quantity = quantity + 1;
else (Quá hạn)
    :Tính số ngày trễ hạn:\nSố ngày trễ = Ngày trả - Ngày hẹn trả;
    :Tính tiền phạt: fine_amount = Số ngày trễ * Đơn giá phạt/ngày;
    :Cập nhật trạng thái phiếu: "QUÁ HẠN" (OVERDUE);
    
    |Thủ thư (Librarian)|
    :Yêu cầu Độc giả thanh toán tiền phạt;
    
    |Độc giả (Reader)|
    :Thanh toán tiền phạt quá hạn;
    
    |Thủ thư (Librarian)|
    :Xác nhận đã thu phạt;
    :Cập nhật hoàn tất phiếu mượn (RETURNED);
    :Cập nhật số lượng sách tồn kho: quantity = quantity + 1;
endif

|Hệ thống Thư viện|
:Gửi email/thông báo hoàn tất giao dịch mượn trả;
stop
@enduml
```

---

### 8. SƠ ĐỒ TRIỂN KHAI HỆ THỐNG (DEPLOYMENT DIAGRAM)
```plantuml
@startuml
title SƠ ĐỒ TRIỂN KHAI HỆ THỐNG BẰNG DOCKER (DEPLOYMENT DIAGRAM)
skinparam shadowing false
skinparam nodePadding 20

node "Thiết Bị Người Dùng (Client Machine)" as ClientNode {
    artifact "Trình duyệt Web\n(Chrome / Edge / Firefox)" as Browser {
        component "React Single Page App\n(HTML5, CSS3, JavaScript)" as ReactApp
    }
}

node "Máy Chủ Triển Khai (Host Server / Cloud VPS)" as ServerHost {
    
    node "Docker Engine" {
        
        node "Container: Frontend Web Server" as WebContainer {
            artifact "Nginx Web Server\n(Port 80 / 443)" as Nginx
        }
        
        node "Container: Backend API Application" as AppContainer {
            artifact "Node.js / Python FastAPI App\n(Port 5000)" as ApiApp
            component "Mô hình Nhúng AI\n(Local Embeddings)" as LocalAI
            ApiApp ..> LocalAI
        }
        
        node "Container: PostgreSQL Database" as DBContainer {
            database "PostgreSQL 16 Server\n(Port 5432)" as PostgresInstance {
                component "Extension: pgvector" as PgVectorExt
            }
        }
        
        storage "Docker Volume Bền Vững\n(pg_data_volume)" as DBVolume
    }
}

ReactApp --> Nginx : HTTP / HTTPS (Port 80/443)
Nginx --> ApiApp : Proxy Pass (Port 5000)
ApiApp --> PostgresInstance : TCP/IP Connection Pool\n(PostgreSQL Protocol - Port 5432)
PostgresInstance --> DBVolume : Mount Disk Storage\n(/var/lib/postgresql/data)
@enduml
```

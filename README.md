# SE104 Jewelry Shop Management Website

Website quản lý cửa hàng vàng bạc đá quý cho đồ án môn Nhập môn Công nghệ Phần mềm.

## Thông Tin Môn Học

* **Tên môn học**: Nhập môn Công nghệ Phần mềm
* **Mã môn học**: SE104
* **Lớp học**: SE104.Q22
* **Tên đề tài**: Web quản lý cửa hàng vàng bạc đá quý

## Thành Viên Nhóm

| STT | MSSV | Họ và tên | Email |
| --- | --- | --- | --- |
| 1 | 23520310 | Nguyễn Minh Đức | 23520310@gm.uit.edu.vn |
| 2 | 23520959 | Trần Tuấn Minh | 23520959@gm.uit.edu.vn |
| 3 | 23520977 | Nguyễn Hữu Phương Nam | 23520977@gm.uit.edu.vn |
| 4 | 23521446 | Lưu Đặng Thành | 23521446@gm.uit.edu.vn |

## Công Nghệ Sử Dụng

* **Frontend**: React, Vite, Tailwind CSS
* **Backend**: Python, FastAPI
* **Database**: PostgreSQL
* **Deploy frontend**: Vercel
* **Deploy backend/API**: Render

## Chức Năng Chính

* Đăng nhập và xác thực người dùng
* Quản lý nhân viên
* Quản lý khách hàng
* Quản lý sản phẩm và tồn kho
* Quản lý nhà cung cấp
* Lập phiếu bán hàng
* Lập phiếu mua hàng
* Lập phiếu dịch vụ
* Lập báo cáo tồn kho
* Xem nhật ký thao tác hệ thống

## Cấu Trúc Dự Án

```text
SE104-JewelryShopManagementWebsite/
├── backend/    # FastAPI backend
└── frontend/   # React/Vite frontend
```

## Cài Đặt Local

### 1. Clone Project

```bash
git clone https://github.com/TunMinhh/SE104-JewelryShopManagementWebsite.git
cd SE104-JewelryShopManagementWebsite
```

### 2. Cài Đặt Backend

```bash
cd backend
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Tạo file `backend/.env` nếu cần cấu hình database:

```env
DATABASE_URL=postgresql://user:password@host:port/database
```

Chạy backend:

```bash
python -m uvicorn app.main:app --reload
```

Backend local mặc định chạy tại:

```text
http://127.0.0.1:8000
```

Swagger API docs:

```text
http://127.0.0.1:8000/docs
```

### 3. Cài Đặt Frontend

Mở terminal mới:

```bash
cd frontend
npm install
```

Tạo file `frontend/.env`:

```env
VITE_API_URL=/api
```

Chạy frontend:

```bash
npm run dev
```

Frontend local mặc định chạy tại:

```text
http://localhost:5173
```

Khi chạy local, frontend gọi API qua `/api`. Vite proxy trong `frontend/vite.config.js` sẽ chuyển request sang backend:

```text
http://127.0.0.1:8000
```

## Cấu Hình API

Frontend dùng biến môi trường:

```env
VITE_API_URL=...
```

Các trường hợp thường dùng:

```env
# Local development, dùng Vite proxy
VITE_API_URL=/api
```

```env
# Production, frontend gọi backend public
VITE_API_URL=https://se104-jewelryshopmanagementwebsite.onrender.com
```

File xử lý API base URL:

```text
frontend/src/lib/api.js
```

## Deploy Frontend Lên Vercel

Cấu hình project trên Vercel:

```text
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

Thêm Environment Variable trên Vercel:

```env
VITE_API_URL=https://se104-jewelryshopmanagementwebsite.onrender.com
```

Sau khi thêm hoặc sửa biến môi trường, cần redeploy frontend trên Vercel.

## Deploy Backend/API Lên Render

Backend cần có biến môi trường kết nối PostgreSQL:

```env
DATABASE_URL=postgresql://user:password@host:port/database
```

Start command khuyến nghị trên Render:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Sau khi deploy backend, kiểm tra API docs:

```text
https://se104-jewelryshopmanagementwebsite.onrender.com/docs
```

Nếu dùng gói free của Render, backend có thể sleep khi lâu không có request. Request đầu tiên sau khi sleep có thể chậm hơn bình thường, nhưng Render sẽ tự wake backend.

## Ghi Chú Khi Deploy

* Người dùng truy cập website bằng link Vercel.
* Frontend trên Vercel gọi API qua backend public trên Render.
* Không cần bật máy local, VS Code, pgAdmin, `npm run dev`, hoặc `uvicorn` local sau khi đã deploy.
* Tắt pgAdmin local không làm PostgreSQL trên Render bị ngắt.
* Nếu đổi URL backend, cần cập nhật `VITE_API_URL` trên Vercel và redeploy frontend.

<p align="center">
  <a href="https://www.uit.edu.vn/" title="Trường Đại học Công nghệ Thông tin" style="border: none;">
    <img src="https://i.imgur.com/WmMnSRt.png" alt="Trường Đại học Công nghệ Thông tin | University of Information Technology">
  </a>
</p>

<h1 align="center"><b>NHẬP MÔN CÔNG NGHỆ PHẦN MỀM</b></h1>

## BẢNG MỤC LỤC
* [Giới thiệu môn học](#gioithieumonhoc)
* [Thành viên nhóm](#thanhvien)
* [Đồ án môn học](#doan)
* [Công nghệ sử dụng](#congnghe)
* [Chức năng hệ thống](#chucnang)
* [Cài đặt và Triển khai](#caidat)

## GIỚI THIỆU MÔN HỌC
<a name="gioithieumonhoc"></a>
* **Tên môn học**: Nhập môn công nghệ phần mềm
* **Mã môn học**: SE104
* **Lớp học**: SE104.Q22


## THÀNH VIÊN NHÓM
<a name="thanhvien"></a>
| STT | MSSV     | Họ và Tên               | Email                       |
|-----|----------|------------------------|-----------------------------|
| 1   | 23520310 | Nguyễn Minh Đức        | 23520310@gm.uit.edu.vn      |
| 2   | 23520959 | Trần Tuấn Minh         | 23520959@gm.uit.edu.vn      |
| 3   | 23520977 | Nguyễn Hữu Phương Nam  | 23520977@gm.uit.edu.vn      |
| 4   | 23521446 | Lưu Đặng Thành         | 23521446@gm.uit.edu.vn      |


## ĐỒ ÁN MÔN HỌC
<a name="doan"></a>
**Tên đề tài: Web quản lý cửa hàng vàng bạc đá quý** 

**Mô tả:**

## CÔNG NGHỆ SỬ DỤNG
<a name="congnghe"></a>
* **Công cụ:** VS Code, Git/GitHub
* **Frontend**: HTML, CSS, Javascript (React Tailwind)
* **Backend**: Python (FastAPI)
* **Database**: PostgreSQL

## CHỨC NĂNG HỆ THỐNG
<a name="chucnang"></a>
* 1	Lập phiếu bán hàng	
* 2	Lập phiếu mua hàng	
* 3	Lập phiếu dịch vụ	
* 4	Tra cứu phiếu dịch vụ		
* 5	Lập báo cáo tồn kho


## CÀI ĐẶT VÀ TRIỂN KHAI
<a name="caidat"></a>
# 1️. Clone project

git clone https://github.com/TunMinhh/SE104-JewelryShopManagementWebsite.git
cd SE104-JewelryShopManagementWebsite

---

# 2. Cài đặt Backend (FastAPI)

cd backend

### Tạo môi trường ảo
python -m venv venv

### Kích hoạt môi trường ảo

PowerShell:
venv\\Scripts\\Activate.ps1

CMD:
venv\\Scripts\\activate

### Cài thư viện
pip install -r requirements.txt

### Chạy server
python -m uvicorn main:app --reload

Backend chạy tại:
http://127.0.0.1:8000

Tài liệu API:
http://127.0.0.1:8000/docs

---

# 3. Cài đặt Frontend (React)

Mở terminal mới:

cd frontend

npm install
npm run dev

Frontend chạy tại:
http://localhost:5173

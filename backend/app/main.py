from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect

from app.database import engine
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.product import Product
from app.models.productcategory import ProductCategory
from app.models.purchaseinvoice import PurchaseInvoice
from app.models.purchaseinvoicedetail import PurchaseInvoiceDetail
from app.models.role import Role
from app.models.salesinvoice import SalesInvoice
from app.models.salesinvoicedetail import SalesInvoiceDetail
from app.models.serviceinvoice import ServiceInvoice
from app.models.serviceinvoicedetail import ServiceInvoiceDetail
from app.models.servicetype import ServiceType
from app.models.supplier import Supplier
from app.routers.auth import router as auth_router

from app.routers.employees import router as employees_router
from app.routers.customers import router as customers_router
from app.routers.products import router as products_router
from app.routers.invoices import router as invoices_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])

app.include_router(employees_router, prefix="/employees", tags=["employees"])
app.include_router(customers_router, prefix="/customers", tags=["customers"])
app.include_router(products_router, prefix="/products", tags=["products"])
app.include_router(invoices_router, prefix="/invoices", tags=["invoices"])

@app.get("/test-db-connection")
def test_db_connection():
    inspector = inspect(engine)
    tables = inspector.get_table_names()

    return {
        "status": "connected",
        "tables_in_database": tables
    }
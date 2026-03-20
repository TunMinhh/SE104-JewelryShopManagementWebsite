from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect
from sqlalchemy.exc import SQLAlchemyError

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
from app.routers.roles import router as roles_router
from app.routers.product_categories import router as product_categories_router
from app.routers.suppliers import router as suppliers_router
from app.routers.sales_invoices import router as sales_invoices_router
from app.routers.purchase_invoices import router as purchase_invoices_router
from app.routers.service_invoices import router as service_invoices_router
from app.routers.service_types import router as service_types_router
from app.routers.dashboard import router as dashboard_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])

app.include_router(employees_router, prefix="/employees", tags=["employees"])
app.include_router(customers_router, prefix="/customers", tags=["customers"])
app.include_router(products_router, prefix="/products", tags=["products"])
app.include_router(roles_router, prefix="/roles", tags=["roles"])
app.include_router(product_categories_router, prefix="/product-categories", tags=["product-categories"])
app.include_router(suppliers_router, prefix="/suppliers", tags=["suppliers"])
app.include_router(sales_invoices_router, prefix="/invoices", tags=["sales-invoices"])
app.include_router(purchase_invoices_router, prefix="/invoices", tags=["purchase-invoices"])
app.include_router(service_types_router, prefix="/service-types", tags=["service-types"])
app.include_router(service_invoices_router, prefix="/service-invoices", tags=["service-invoices"])
app.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])

@app.get("/test-db-connection")
def test_db_connection():
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail=f"Database connection failed: {exc}") from exc

    return {
        "status": "connected",
        "tables_in_database": tables
    }
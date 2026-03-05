from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from sqlalchemy import inspect

from app.database import SessionLocal, engine
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

app = FastAPI()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/test-db-connection")
def test_db_connection():
    inspector = inspect(engine)
    tables = inspector.get_table_names()

    return {
        "status": "connected",
        "tables_in_database": tables
    }
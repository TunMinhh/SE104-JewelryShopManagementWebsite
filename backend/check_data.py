#!/usr/bin/env python3
from app.database import SessionLocal
# Import all models to ensure mapper configuration
from app.models.role import Role
from app.models.employee import Employee
from app.models.customer import Customer
from app.models.product import Product
from app.models.productcategory import ProductCategory
from app.models.purchaseinvoice import PurchaseInvoice
from app.models.purchaseinvoicedetail import PurchaseInvoiceDetail
from app.models.salesinvoice import SalesInvoice
from app.models.salesinvoicedetail import SalesInvoiceDetail
from app.models.serviceinvoice import ServiceInvoice
from app.models.serviceinvoicedetail import ServiceInvoiceDetail
from app.models.servicetype import ServiceType
from app.models.supplier import Supplier

db = SessionLocal()

print("=== EMPLOYEES ===")
employees = db.query(Employee).all()
print(f"Total: {len(employees)}")
for emp in employees:
    print(f"  ID: {emp.employeeid}, Name: {emp.employeename}, Username: {emp.username}")

print("\n=== CUSTOMERS ===")
customers = db.query(Customer).all()
print(f"Total: {len(customers)}")
for cust in customers[:5]:
    print(f"  ID: {cust.customerid}, Name: {cust.customername}, Phone: {cust.phonenumber}")

print("\n=== PRODUCTS ===")
products = db.query(Product).all()
print(f"Total: {len(products)}")
for prod in products[:5]:
    print(f"  ID: {prod.productid}, Name: {prod.productname}, Price: {prod.purchaseprice}")

print("\n=== SALES INVOICES ===")
sales = db.query(SalesInvoice).all()
print(f"Total: {len(sales)}")
for sale in sales[:5]:
    total = sum(float(d.totalamount) if d.totalamount else 0 for d in sale.details)
    print(f"  ID: {sale.salesinvoiceid}, Customer: {sale.customerid}, Amount: {total}")

db.close()
print("\nDone!")

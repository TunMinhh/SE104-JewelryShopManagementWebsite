from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.auth import decode_access_token
from app.database import SessionLocal
from app.models.salesinvoice import SalesInvoice
from app.models.purchaseinvoice import PurchaseInvoice
from app.models.serviceinvoice import ServiceInvoice
from app.models.employee import Employee

router = APIRouter()
security = HTTPBearer(auto_error=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_employee(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    
    token_data = decode_access_token(credentials.credentials)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    
    employee = db.query(Employee).filter(Employee.employeeid == int(token_data["sub"])).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    return employee


@router.get("/sales")
def list_sales_invoices(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    invoices = db.query(SalesInvoice).all()
    return [
        {
            "invoiceid": inv.salesinvoiceid,
            "invoicedate": inv.createddate,
            "customerid": inv.customerid,
            "totalamount": sum(float(d.totalamount) if d.totalamount else 0 for d in inv.details),
        }
        for inv in invoices
    ]


@router.get("/sales/count")
def count_sales_invoices(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    count = db.query(func.count(SalesInvoice.salesinvoiceid)).scalar()
    return {"count": count or 0}


@router.get("/purchases")
def list_purchase_invoices(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    invoices = db.query(PurchaseInvoice).all()
    return [
        {
            "invoiceid": inv.purchaseinvoiceid,
            "invoicedate": inv.createddate,
            "supplierid": inv.supplierid,
            "totalamount": sum(float(d.totalamount) if d.totalamount else 0 for d in inv.details),
        }
        for inv in invoices
    ]


@router.get("/services")
def list_service_invoices(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    invoices = db.query(ServiceInvoice).all()
    return [
        {
            "invoiceid": inv.serviceinvoiceid,
            "invoicedate": inv.createddate,
            "customerid": inv.customerid,
            "totalamount": float(inv.totalamount) if inv.totalamount else 0,
        }
        for inv in invoices
    ]


@router.get("/services/count")
def count_service_invoices(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    count = db.query(func.count(ServiceInvoice.serviceinvoiceid)).scalar()
    return {"count": count or 0}

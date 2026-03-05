from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.auth import decode_access_token
from app.database import SessionLocal
from app.models.customer import Customer
from app.models.salesinvoice import SalesInvoice
from app.models.salesinvoicedetail import SalesInvoiceDetail
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


def _calc_change_percent(current: float, previous: float):
    if previous == 0:
        return 0.0 if current == 0 else None
    return round(((current - previous) / previous) * 100, 1)


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


@router.get("/overview/trends")
def get_overview_trends(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    today = date.today()
    current_start = today - timedelta(days=days - 1)
    previous_end = current_start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=days - 1)

    sales_count_current = (
        db.query(func.count(SalesInvoice.salesinvoiceid))
        .filter(SalesInvoice.createddate >= current_start, SalesInvoice.createddate <= today)
        .scalar()
        or 0
    )
    sales_count_previous = (
        db.query(func.count(SalesInvoice.salesinvoiceid))
        .filter(SalesInvoice.createddate >= previous_start, SalesInvoice.createddate <= previous_end)
        .scalar()
        or 0
    )

    services_count_current = (
        db.query(func.count(ServiceInvoice.serviceinvoiceid))
        .filter(ServiceInvoice.createddate >= current_start, ServiceInvoice.createddate <= today)
        .scalar()
        or 0
    )
    services_count_previous = (
        db.query(func.count(ServiceInvoice.serviceinvoiceid))
        .filter(ServiceInvoice.createddate >= previous_start, ServiceInvoice.createddate <= previous_end)
        .scalar()
        or 0
    )

    sales_total_current = float(
        db.query(func.coalesce(func.sum(SalesInvoiceDetail.totalamount), 0))
        .join(SalesInvoice, SalesInvoice.salesinvoiceid == SalesInvoiceDetail.salesinvoiceid)
        .filter(SalesInvoice.createddate >= current_start, SalesInvoice.createddate <= today)
        .scalar()
        or 0
    )
    sales_total_previous = float(
        db.query(func.coalesce(func.sum(SalesInvoiceDetail.totalamount), 0))
        .join(SalesInvoice, SalesInvoice.salesinvoiceid == SalesInvoiceDetail.salesinvoiceid)
        .filter(SalesInvoice.createddate >= previous_start, SalesInvoice.createddate <= previous_end)
        .scalar()
        or 0
    )

    customers_total = db.query(func.count(Customer.customerid)).scalar() or 0

    return {
        "period_days": days,
        "ranges": {
            "current": {
                "start": current_start.isoformat(),
                "end": today.isoformat(),
            },
            "previous": {
                "start": previous_start.isoformat(),
                "end": previous_end.isoformat(),
            },
        },
        "sales_total": {
            "current": sales_total_current,
            "previous": sales_total_previous,
            "change_percent": _calc_change_percent(sales_total_current, sales_total_previous),
        },
        "sales_count": {
            "current": sales_count_current,
            "previous": sales_count_previous,
            "change_percent": _calc_change_percent(float(sales_count_current), float(sales_count_previous)),
        },
        "services_count": {
            "current": services_count_current,
            "previous": services_count_previous,
            "change_percent": _calc_change_percent(float(services_count_current), float(services_count_previous)),
        },
        "customers_count": {
            "current": customers_total,
            "previous": None,
            "change_percent": None,
            "note": "Customer model does not have created date, so trend cannot be calculated yet.",
        },
    }

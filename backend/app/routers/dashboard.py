from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.deps import get_db, require_admin
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.salesinvoice import SalesInvoice
from app.models.salesinvoicedetail import SalesInvoiceDetail
from app.models.serviceinvoice import ServiceInvoice

router = APIRouter()


def _calc_change_percent(current: float, previous: float):
    if previous == 0:
        return 0.0 if current == 0 else None
    return round(((current - previous) / previous) * 100, 1)


@router.get("/trends")
def get_overview_trends(
    days: int = Query(default=30, ge=1, le=365),
    period: str = Query(default="days"),
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    today = date.today()
    if period == "week":
        current_start = today - timedelta(days=today.weekday())
        previous_start = current_start - timedelta(days=7)
        previous_end = current_start - timedelta(days=1)
        days = 7
    else:
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
        "period": period,
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

from calendar import monthrange
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.deps import format_code, get_db, get_current_employee
from app.models.employee import Employee
from app.models.product import Product
from app.models.purchaseinvoice import PurchaseInvoice
from app.models.purchaseinvoicedetail import PurchaseInvoiceDetail
from app.models.salesinvoice import SalesInvoice
from app.models.salesinvoicedetail import SalesInvoiceDetail

router = APIRouter()


def _build_quantity_map(query_results):
    return {
        product_id: float(quantity or 0)
        for product_id, quantity in query_results
    }


@router.get("/stock")
def get_stock_report(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    start_date = date(year, month, 1)
    end_date = date(year, month, monthrange(year, month)[1])

    purchase_before = _build_quantity_map(
        db.query(
            PurchaseInvoiceDetail.productid,
            func.coalesce(func.sum(PurchaseInvoiceDetail.quantity), 0),
        )
        .join(PurchaseInvoice, PurchaseInvoice.purchaseinvoiceid == PurchaseInvoiceDetail.purchaseinvoiceid)
        .filter(PurchaseInvoice.createddate < start_date)
        .group_by(PurchaseInvoiceDetail.productid)
        .all()
    )

    sales_before = _build_quantity_map(
        db.query(
            SalesInvoiceDetail.productid,
            func.coalesce(func.sum(SalesInvoiceDetail.quantity), 0),
        )
        .join(SalesInvoice, SalesInvoice.salesinvoiceid == SalesInvoiceDetail.salesinvoiceid)
        .filter(SalesInvoice.createddate < start_date)
        .group_by(SalesInvoiceDetail.productid)
        .all()
    )

    purchase_in_month = _build_quantity_map(
        db.query(
            PurchaseInvoiceDetail.productid,
            func.coalesce(func.sum(PurchaseInvoiceDetail.quantity), 0),
        )
        .join(PurchaseInvoice, PurchaseInvoice.purchaseinvoiceid == PurchaseInvoiceDetail.purchaseinvoiceid)
        .filter(PurchaseInvoice.createddate >= start_date, PurchaseInvoice.createddate <= end_date)
        .group_by(PurchaseInvoiceDetail.productid)
        .all()
    )

    sales_in_month = _build_quantity_map(
        db.query(
            SalesInvoiceDetail.productid,
            func.coalesce(func.sum(SalesInvoiceDetail.quantity), 0),
        )
        .join(SalesInvoice, SalesInvoice.salesinvoiceid == SalesInvoiceDetail.salesinvoiceid)
        .filter(SalesInvoice.createddate >= start_date, SalesInvoice.createddate <= end_date)
        .group_by(SalesInvoiceDetail.productid)
        .all()
    )

    products = (
        db.query(Product)
        .options(joinedload(Product.category))
        .order_by(Product.productid.asc())
        .all()
    )

    items = []
    for product in products:
        opening_quantity = purchase_before.get(product.productid, 0) - sales_before.get(product.productid, 0)
        purchased_quantity = purchase_in_month.get(product.productid, 0)
        sold_quantity = sales_in_month.get(product.productid, 0)
        closing_quantity = opening_quantity + purchased_quantity - sold_quantity

        items.append({
            "productid": product.productid,
            "productcode": format_code("SP", product.productid),
            "productname": product.productname,
            "unitofmeasure": product.category.unitofmeasure if product.category else None,
            "openingquantity": opening_quantity,
            "purchasedquantity": purchased_quantity,
            "soldquantity": sold_quantity,
            "closingquantity": closing_quantity,
        })

    return {
        "period": {
            "year": year,
            "month": month,
            "label": f"{month:02d}/{year}",
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
        "items": items,
    }

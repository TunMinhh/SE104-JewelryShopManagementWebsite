from datetime import date, timedelta
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.auth import decode_access_token
from app.database import SessionLocal
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.product import Product
from app.models.purchaseinvoice import PurchaseInvoice
from app.models.salesinvoice import SalesInvoice
from app.models.salesinvoicedetail import SalesInvoiceDetail
from app.models.serviceinvoice import ServiceInvoice

router = APIRouter()
security = HTTPBearer(auto_error=False)


class SalesInvoiceLineItemPayload(BaseModel):
    productid: int
    quantity: int = Field(gt=0)
    sellingprice: float | None = Field(default=None, gt=0)


class SalesInvoicePayload(BaseModel):
    customerid: int
    createddate: date
    items: List[SalesInvoiceLineItemPayload] = Field(min_length=1)


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


def _to_float(value):
    return float(value) if value is not None else 0.0


def _get_product_selling_price(product: Product) -> Decimal:
    purchase_price = Decimal(str(product.purchaseprice or 0))
    profit_percentage = Decimal(str(product.category.profitpercentage if product.category and product.category.profitpercentage is not None else 0))
    selling_price = purchase_price * (Decimal("1") + (profit_percentage / Decimal("100")))
    return selling_price.quantize(Decimal("0.01"))


def _get_sales_invoice_query(db: Session):
    return db.query(SalesInvoice).options(
        joinedload(SalesInvoice.customer),
        joinedload(SalesInvoice.details)
        .joinedload(SalesInvoiceDetail.product)
        .joinedload(Product.category),
    )


def _serialize_sales_invoice_detail(detail: SalesInvoiceDetail):
    product = detail.product
    category = product.category if product else None
    return {
        "salesinvoicedetailid": detail.salesinvoicedetailid,
        "productid": detail.productid,
        "productname": product.productname if product else None,
        "categoryname": category.categoryname if category else None,
        "unitofmeasure": product.unitofmeasure if product else None,
        "quantity": int(detail.quantity) if detail.quantity is not None else 0,
        "sellingprice": _to_float(detail.sellingprice),
        "totalamount": _to_float(detail.totalamount),
    }


def _serialize_sales_invoice(invoice: SalesInvoice, include_details: bool = False):
    ordered_details = sorted(invoice.details, key=lambda detail: detail.salesinvoicedetailid or 0)
    payload = {
        "invoiceid": invoice.salesinvoiceid,
        "invoicedate": invoice.createddate.isoformat() if invoice.createddate else None,
        "customerid": invoice.customerid,
        "customername": invoice.customer.customername if invoice.customer else None,
        "totalamount": round(sum(_to_float(detail.totalamount) for detail in ordered_details), 2),
        "itemcount": len(ordered_details),
    }
    if include_details:
        payload["details"] = [_serialize_sales_invoice_detail(detail) for detail in ordered_details]
    return payload


def _validate_sales_invoice_payload(payload: SalesInvoicePayload, db: Session):
    customer = db.query(Customer).filter(Customer.customerid == payload.customerid).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )

    product_ids = [item.productid for item in payload.items]
    if len(product_ids) != len(set(product_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate products are not allowed in the same invoice",
        )

    products = db.query(Product).options(joinedload(Product.category)).filter(Product.productid.in_(product_ids)).all()
    product_map = {product.productid: product for product in products}

    missing_product_ids = [product_id for product_id in product_ids if product_id not in product_map]
    if missing_product_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Products not found: {', '.join(str(product_id) for product_id in missing_product_ids)}",
        )

    products_without_price = [product.productname for product in products if _get_product_selling_price(product) <= 0]
    if products_without_price:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Products do not have a valid fixed selling price: {', '.join(products_without_price)}",
        )

    return customer, product_map


def _replace_sales_invoice_details(invoice: SalesInvoice, payload: SalesInvoicePayload, db: Session):
    _, product_map = _validate_sales_invoice_payload(payload, db)

    invoice.createddate = payload.createddate
    invoice.customerid = payload.customerid

    for existing_detail in list(invoice.details):
        db.delete(existing_detail)
    db.flush()

    for item in payload.items:
        quantity = Decimal(str(item.quantity))
        product = product_map[item.productid]
        selling_price = _get_product_selling_price(product)
        total_amount = quantity * selling_price

        db.add(
            SalesInvoiceDetail(
                salesinvoiceid=invoice.salesinvoiceid,
                productid=product.productid,
                quantity=quantity,
                sellingprice=selling_price,
                totalamount=total_amount,
            )
        )


def _get_sales_invoice_or_404(invoice_id: int, db: Session):
    invoice = (
        _get_sales_invoice_query(db)
        .filter(SalesInvoice.salesinvoiceid == invoice_id)
        .first()
    )
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sales invoice not found",
        )
    return invoice


@router.get("/sales")
def list_sales_invoices(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    invoices = (
        _get_sales_invoice_query(db)
        .order_by(SalesInvoice.createddate.desc(), SalesInvoice.salesinvoiceid.desc())
        .all()
    )
    return [_serialize_sales_invoice(invoice) for invoice in invoices]


@router.get("/sales/count")
def count_sales_invoices(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    count = db.query(func.count(SalesInvoice.salesinvoiceid)).scalar()
    return {"count": count or 0}


@router.get("/sales/{invoice_id}")
def get_sales_invoice(invoice_id: int, db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    invoice = _get_sales_invoice_or_404(invoice_id, db)
    return _serialize_sales_invoice(invoice, include_details=True)


@router.post("/sales", status_code=status.HTTP_201_CREATED)
def create_sales_invoice(
    payload: SalesInvoicePayload,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    _validate_sales_invoice_payload(payload, db)

    invoice = SalesInvoice(
        createddate=payload.createddate,
        customerid=payload.customerid,
    )
    db.add(invoice)
    db.flush()

    _replace_sales_invoice_details(invoice, payload, db)

    db.commit()
    created_invoice = _get_sales_invoice_or_404(invoice.salesinvoiceid, db)
    return _serialize_sales_invoice(created_invoice, include_details=True)


@router.put("/sales/{invoice_id}")
def update_sales_invoice(
    invoice_id: int,
    payload: SalesInvoicePayload,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    invoice = _get_sales_invoice_or_404(invoice_id, db)
    _replace_sales_invoice_details(invoice, payload, db)
    db.commit()
    updated_invoice = _get_sales_invoice_or_404(invoice_id, db)
    return _serialize_sales_invoice(updated_invoice, include_details=True)


@router.delete("/sales/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sales_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    invoice = db.query(SalesInvoice).filter(SalesInvoice.salesinvoiceid == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sales invoice not found",
        )

    db.delete(invoice)
    db.commit()


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

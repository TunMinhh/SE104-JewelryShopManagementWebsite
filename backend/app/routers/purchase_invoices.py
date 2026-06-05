from datetime import date
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.deps import format_code, get_db, get_current_employee, to_float, log_action
from app.models.employee import Employee
from app.models.product import Product
from app.models.purchaseinvoicedetail import PurchaseInvoiceDetail
from app.models.purchaseinvoice import PurchaseInvoice
from app.models.supplier import Supplier

router = APIRouter()


class PurchaseInvoiceLineItemPayload(BaseModel):
    productid: int
    quantity: int = Field(gt=0)
    purchaseprice: float = Field(gt=0)


class PurchaseInvoicePayload(BaseModel):
    supplierid: int
    createddate: date
    items: List[PurchaseInvoiceLineItemPayload] = Field(min_length=1)


def _get_purchase_invoice_query(db: Session):
    return db.query(PurchaseInvoice).options(
        joinedload(PurchaseInvoice.supplier),
        joinedload(PurchaseInvoice.details)
        .joinedload(PurchaseInvoiceDetail.product)
        .joinedload(Product.category),
    )


def _serialize_purchase_invoice_detail(detail: PurchaseInvoiceDetail):
    product = detail.product
    category = product.category if product else None
    return {
        "purchaseinvoicedetailid": detail.purchaseinvoicedetailid,
        "productid": detail.productid,
        "productcode": format_code("SP", detail.productid),
        "productname": product.productname if product else None,
        "categoryname": category.categoryname if category else None,
        "unitofmeasure": category.unitofmeasure if category else None,
        "quantity": int(detail.quantity) if detail.quantity is not None else 0,
        "purchaseprice": to_float(detail.purchaseprice),
        "totalamount": to_float(detail.totalamount),
    }


def _serialize_purchase_invoice(invoice: PurchaseInvoice, include_details: bool = False):
    ordered_details = sorted(invoice.details, key=lambda detail: detail.purchaseinvoicedetailid or 0)
    payload = {
        "invoiceid": invoice.purchaseinvoiceid,
        "invoicecode": format_code("PM", invoice.purchaseinvoiceid),
        "invoicedate": invoice.createddate.isoformat() if invoice.createddate else None,
        "supplierid": invoice.supplierid,
        "suppliercode": format_code("NCC", invoice.supplierid),
        "suppliername": invoice.supplier.suppliername if invoice.supplier else None,
        "supplieraddress": invoice.supplier.address if invoice.supplier else None,
        "supplierphonenumber": invoice.supplier.phonenumber if invoice.supplier else None,
        "totalamount": round(sum(to_float(detail.totalamount) for detail in ordered_details), 2),
        "itemcount": len(ordered_details),
    }
    if include_details:
        payload["details"] = [_serialize_purchase_invoice_detail(detail) for detail in ordered_details]
    return payload


def _validate_purchase_invoice_payload(payload: PurchaseInvoicePayload, db: Session):
    supplier = db.query(Supplier).filter(Supplier.supplierid == payload.supplierid).first()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found",
        )

    product_ids = [item.productid for item in payload.items]
    if len(product_ids) != len(set(product_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate products are not allowed in the same purchase invoice",
        )

    products = db.query(Product).options(joinedload(Product.category)).filter(Product.productid.in_(product_ids)).all()
    product_map = {product.productid: product for product in products}

    missing_product_ids = [product_id for product_id in product_ids if product_id not in product_map]
    if missing_product_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Products not found: {', '.join(str(product_id) for product_id in missing_product_ids)}",
        )

    return supplier, product_map


def _replace_purchase_invoice_details(invoice: PurchaseInvoice, payload: PurchaseInvoicePayload, db: Session):
    _, product_map = _validate_purchase_invoice_payload(payload, db)

    invoice.createddate = payload.createddate
    invoice.supplierid = payload.supplierid

    for existing_detail in list(invoice.details):
        db.delete(existing_detail)
    db.flush()

    for item in payload.items:
        quantity = Decimal(str(item.quantity))
        product = product_map[item.productid]
        purchase_price = Decimal(str(item.purchaseprice)).quantize(Decimal("0.01"))
        total_amount = quantity * purchase_price

        db.add(
            PurchaseInvoiceDetail(
                purchaseinvoiceid=invoice.purchaseinvoiceid,
                productid=product.productid,
                quantity=quantity,
                purchaseprice=purchase_price,
                totalamount=total_amount,
            )
        )


def _get_purchase_invoice_or_404(invoice_id: int, db: Session):
    invoice = (
        _get_purchase_invoice_query(db)
        .filter(PurchaseInvoice.purchaseinvoiceid == invoice_id)
        .first()
    )
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase invoice not found",
        )
    return invoice


@router.get("/purchases")
def list_purchase_invoices(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    invoices = (
        _get_purchase_invoice_query(db)
        .order_by(PurchaseInvoice.purchaseinvoiceid.asc())
        .all()
    )
    return [_serialize_purchase_invoice(invoice) for invoice in invoices]


@router.get("/purchases/{invoice_id}")
def get_purchase_invoice(invoice_id: int, db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    invoice = _get_purchase_invoice_or_404(invoice_id, db)
    return _serialize_purchase_invoice(invoice, include_details=True)


@router.post("/purchases", status_code=status.HTTP_201_CREATED)
def create_purchase_invoice(
    payload: PurchaseInvoicePayload,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    _validate_purchase_invoice_payload(payload, db)

    invoice = PurchaseInvoice(
        createddate=payload.createddate,
        supplierid=payload.supplierid,
    )
    db.add(invoice)
    db.flush()

    _replace_purchase_invoice_details(invoice, payload, db)

    db.commit()
    created_invoice = _get_purchase_invoice_or_404(invoice.purchaseinvoiceid, db)
    log_action(db, current_employee.employeeid, "CREATE", "PurchaseInvoice", invoice.purchaseinvoiceid, f"Tạo phiếu mua {format_code('PM', invoice.purchaseinvoiceid)}")
    return _serialize_purchase_invoice(created_invoice, include_details=True)


@router.put("/purchases/{invoice_id}")
def update_purchase_invoice(
    invoice_id: int,
    payload: PurchaseInvoicePayload,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    invoice = _get_purchase_invoice_or_404(invoice_id, db)
    _replace_purchase_invoice_details(invoice, payload, db)
    db.commit()
    updated_invoice = _get_purchase_invoice_or_404(invoice_id, db)
    log_action(db, current_employee.employeeid, "UPDATE", "PurchaseInvoice", invoice_id, f"Cập nhật phiếu mua {format_code('PM', invoice_id)}")
    return _serialize_purchase_invoice(updated_invoice, include_details=True)


@router.delete("/purchases/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    invoice = db.query(PurchaseInvoice).filter(PurchaseInvoice.purchaseinvoiceid == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase invoice not found",
        )

    db.delete(invoice)
    db.commit()
    log_action(db, current_employee.employeeid, "DELETE", "PurchaseInvoice", invoice_id, f"Xóa phiếu mua {format_code('PM', invoice_id)}")

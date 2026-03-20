from datetime import date
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.auth import decode_access_token
from app.database import SessionLocal
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.serviceinvoice import ServiceInvoice
from app.models.serviceinvoicedetail import ServiceInvoiceDetail
from app.models.servicetype import ServiceType

router = APIRouter()
security = HTTPBearer(auto_error=False)


class ServiceInvoiceLineItemPayload(BaseModel):
    servicetypeid: int
    quantity: int = Field(gt=0)
    actualprice: float = Field(gt=0)
    paidamount: float = Field(ge=0)
    deliverydate: date | None = None


class ServiceInvoicePayload(BaseModel):
    customerid: int
    createddate: date
    items: List[ServiceInvoiceLineItemPayload] = Field(min_length=1)


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


def _to_float(value):
    return float(value) if value is not None else 0.0


def _to_money(value):
    return Decimal(str(value)).quantize(Decimal("0.01"))


def _get_service_invoice_query(db: Session):
    return db.query(ServiceInvoice).options(
        joinedload(ServiceInvoice.customer),
        joinedload(ServiceInvoice.details).joinedload(ServiceInvoiceDetail.servicetype),
    )


def _validate_service_invoice_payload(payload: ServiceInvoicePayload, db: Session):
    customer = db.query(Customer).filter(Customer.customerid == payload.customerid).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )

    service_type_ids = [item.servicetypeid for item in payload.items]
    if len(service_type_ids) != len(set(service_type_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate service types are not allowed in the same service invoice",
        )

    service_types = db.query(ServiceType).filter(ServiceType.servicetypeid.in_(service_type_ids)).all()
    service_type_map = {service_type.servicetypeid: service_type for service_type in service_types}

    missing_service_type_ids = [service_type_id for service_type_id in service_type_ids if service_type_id not in service_type_map]
    if missing_service_type_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service types not found: {', '.join(str(service_type_id) for service_type_id in missing_service_type_ids)}",
        )

    return customer, service_type_map


def _replace_service_invoice_details(invoice: ServiceInvoice, payload: ServiceInvoicePayload, db: Session):
    _, service_type_map = _validate_service_invoice_payload(payload, db)

    invoice.createddate = payload.createddate
    invoice.customerid = payload.customerid

    for existing_detail in list(invoice.details):
        db.delete(existing_detail)
    db.flush()

    total_amount = Decimal("0.00")
    total_paid = Decimal("0.00")
    remaining_amount = Decimal("0.00")
    is_completed = True

    for item in payload.items:
        service_type = service_type_map[item.servicetypeid]
        quantity = Decimal(str(item.quantity))
        default_price = _to_money(service_type.defaultserviceprice or 0)
        actual_price = _to_money(item.actualprice)
        line_total = (quantity * actual_price).quantize(Decimal("0.01"))
        paid_amount = _to_money(item.paidamount)
        minimum_paid_amount = (line_total * Decimal("0.50")).quantize(Decimal("0.01"))

        if paid_amount < minimum_paid_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Paid amount must be at least 50% of total amount for service type {service_type.servicename}",
            )

        if paid_amount > line_total:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Paid amount cannot exceed total amount for service type {service_type.servicename}",
            )

        line_remaining = (line_total - paid_amount).quantize(Decimal("0.01"))
        if not item.deliverydate:
            is_completed = False

        db.add(
            ServiceInvoiceDetail(
                serviceinvoiceid=invoice.serviceinvoiceid,
                servicetypeid=service_type.servicetypeid,
                defaultprice=default_price,
                actualprice=actual_price,
                quantity=quantity,
                totalamount=line_total,
                paidamount=paid_amount,
                remainingamount=line_remaining,
                deliverydate=item.deliverydate,
            )
        )

        total_amount += line_total
        total_paid += paid_amount
        remaining_amount += line_remaining

    invoice.totalamount = total_amount.quantize(Decimal("0.01"))
    invoice.totalpaid = total_paid.quantize(Decimal("0.01"))
    invoice.remainingamount = remaining_amount.quantize(Decimal("0.01"))
    invoice.status = "Đã giao" if is_completed else "Chưa giao"


def _serialize_service_invoice_detail(detail: ServiceInvoiceDetail):
    service_type = detail.servicetype
    is_delivered = bool(detail.deliverydate)
    return {
        "serviceinvoicedetailid": detail.serviceinvoicedetailid,
        "servicetypeid": detail.servicetypeid,
        "servicename": service_type.servicename if service_type else None,
        "defaultprice": _to_float(detail.defaultprice if detail.defaultprice is not None else (service_type.defaultserviceprice if service_type else 0)),
        "actualprice": _to_float(detail.actualprice),
        "quantity": int(detail.quantity) if detail.quantity is not None else 0,
        "totalamount": _to_float(detail.totalamount),
        "paidamount": _to_float(detail.paidamount),
        "remainingamount": _to_float(detail.remainingamount),
        "deliverydate": detail.deliverydate.isoformat() if detail.deliverydate else None,
        "status": "Đã giao" if is_delivered else "Chưa giao",
    }


def _serialize_service_invoice(invoice: ServiceInvoice, include_details: bool = False):
    ordered_details = sorted(invoice.details, key=lambda detail: detail.serviceinvoicedetailid or 0)
    is_completed = bool(ordered_details) and all(detail.deliverydate for detail in ordered_details)
    service_names = [detail.servicetype.servicename for detail in ordered_details if detail.servicetype and detail.servicetype.servicename]
    payload = {
        "invoiceid": invoice.serviceinvoiceid,
        "invoicedate": invoice.createddate.isoformat() if invoice.createddate else None,
        "customerid": invoice.customerid,
        "customername": invoice.customer.customername if invoice.customer else None,
        "customerphonenumber": invoice.customer.phonenumber if invoice.customer else None,
        "totalamount": _to_float(invoice.totalamount),
        "totalpaid": _to_float(invoice.totalpaid),
        "remainingamount": _to_float(invoice.remainingamount),
        "status": invoice.status or ("Đã giao" if is_completed else "Chưa giao"),
        "itemcount": len(ordered_details),
        "servicenames": service_names,
        "servicenamesummary": ", ".join(service_names),
    }
    if include_details:
        payload["details"] = [_serialize_service_invoice_detail(detail) for detail in ordered_details]
    return payload


def _get_service_invoice_or_404(invoice_id: int, db: Session):
    invoice = (
        _get_service_invoice_query(db)
        .filter(ServiceInvoice.serviceinvoiceid == invoice_id)
        .first()
    )
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service invoice not found",
        )
    return invoice


@router.get("")
@router.get("/", include_in_schema=False)
def list_service_invoices(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    invoices = (
        _get_service_invoice_query(db)
        .order_by(ServiceInvoice.createddate.desc(), ServiceInvoice.serviceinvoiceid.desc())
        .all()
    )
    return [_serialize_service_invoice(invoice) for invoice in invoices]


@router.get("/count")
def count_service_invoices(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    count = db.query(func.count(ServiceInvoice.serviceinvoiceid)).scalar()
    return {"count": count or 0}


@router.get("/{invoice_id}")
def get_service_invoice(invoice_id: int, db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    invoice = _get_service_invoice_or_404(invoice_id, db)
    return _serialize_service_invoice(invoice, include_details=True)


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", include_in_schema=False, status_code=status.HTTP_201_CREATED)
def create_service_invoice(
    payload: ServiceInvoicePayload,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    _validate_service_invoice_payload(payload, db)

    invoice = ServiceInvoice(
        createddate=payload.createddate,
        customerid=payload.customerid,
        totalamount=Decimal("0.00"),
        totalpaid=Decimal("0.00"),
        remainingamount=Decimal("0.00"),
        status="Chưa hoàn thành",
    )
    db.add(invoice)
    db.flush()

    _replace_service_invoice_details(invoice, payload, db)

    db.commit()
    created_invoice = _get_service_invoice_or_404(invoice.serviceinvoiceid, db)
    return _serialize_service_invoice(created_invoice, include_details=True)


@router.put("/{invoice_id}")
def update_service_invoice(
    invoice_id: int,
    payload: ServiceInvoicePayload,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    invoice = _get_service_invoice_or_404(invoice_id, db)
    _replace_service_invoice_details(invoice, payload, db)
    db.commit()
    updated_invoice = _get_service_invoice_or_404(invoice_id, db)
    return _serialize_service_invoice(updated_invoice, include_details=True)


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    invoice = db.query(ServiceInvoice).filter(ServiceInvoice.serviceinvoiceid == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service invoice not found",
        )

    for detail in db.query(ServiceInvoiceDetail).filter(ServiceInvoiceDetail.serviceinvoiceid == invoice_id).all():
        db.delete(detail)

    db.delete(invoice)
    db.commit()
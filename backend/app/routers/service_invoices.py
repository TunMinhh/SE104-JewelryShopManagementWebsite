from datetime import date
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.deps import format_code, get_db, get_current_employee, to_float, log_action
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.serviceinvoice import ServiceInvoice
from app.models.serviceinvoicedetail import ServiceInvoiceDetail
from app.models.servicepayment import ServicePayment
from app.models.servicetype import ServiceType

router = APIRouter()


class ServiceInvoiceLineItemPayload(BaseModel):
    servicetypeid: int
    quantity: int = Field(gt=0)
    extraamount: float = Field(default=0, ge=0)
    actualprice: float | None = Field(default=None, gt=0)
    paidamount: float = Field(ge=0)
    deliverydate: date | None = None


class ServiceInvoicePayload(BaseModel):
    customerid: int
    createddate: date
    items: List[ServiceInvoiceLineItemPayload] = Field(min_length=1)


class ServicePaymentPayload(BaseModel):
    amount: float = Field(gt=0)
    paymentdate: date
    note: str | None = None


def _to_money(value):
    return Decimal(str(value)).quantize(Decimal("0.01"))


def _get_service_invoice_query(db: Session):
    return db.query(ServiceInvoice).options(
        joinedload(ServiceInvoice.customer),
        joinedload(ServiceInvoice.details).joinedload(ServiceInvoiceDetail.servicetype),
        joinedload(ServiceInvoice.payments),
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
        extra_amount = _to_money(item.extraamount)
        actual_price = (default_price + extra_amount).quantize(Decimal("0.01"))
        line_total = (quantity * actual_price).quantize(Decimal("0.01"))
        paid_amount = _to_money(item.paidamount)
        minimum_paid_amount = (line_total * Decimal("0.50")).quantize(Decimal("0.01"))

        if paid_amount < minimum_paid_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Số tiền trả trước phải từ 50% đến 100% giá trị dịch vụ {service_type.servicename}",
            )

        if paid_amount > line_total:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Số tiền trả trước phải từ 50% đến 100% giá trị dịch vụ {service_type.servicename}",
            )

        line_remaining = (line_total - paid_amount).quantize(Decimal("0.01"))
        if not item.deliverydate:
            is_completed = False

        db.add(
            ServiceInvoiceDetail(
                serviceinvoiceid=invoice.serviceinvoiceid,
                servicetypeid=service_type.servicetypeid,
                defaultprice=default_price,
                extraamount=extra_amount,
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

    additional_paid = sum((_to_money(payment.amount) for payment in invoice.payments), Decimal("0.00"))
    invoice.totalamount = total_amount.quantize(Decimal("0.01"))
    invoice.totalpaid = (total_paid + additional_paid).quantize(Decimal("0.01"))
    invoice.remainingamount = (invoice.totalamount - invoice.totalpaid).quantize(Decimal("0.01"))
    if invoice.remainingamount < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tổng tiền sau khi sửa phiếu không được nhỏ hơn số tiền khách đã thanh toán",
        )
    invoice.status = "Hoàn thành" if is_completed else "Chưa hoàn thành"


def _serialize_service_invoice_detail(detail: ServiceInvoiceDetail):
    service_type = detail.servicetype
    is_delivered = bool(detail.deliverydate)
    return {
        "serviceinvoicedetailid": detail.serviceinvoicedetailid,
        "servicetypeid": detail.servicetypeid,
        "servicetypecode": format_code("DV", detail.servicetypeid),
        "servicename": service_type.servicename if service_type else None,
        "defaultprice": to_float(detail.defaultprice if detail.defaultprice is not None else (service_type.defaultserviceprice if service_type else 0)),
        "extraamount": to_float(detail.extraamount),
        "actualprice": to_float(detail.actualprice),
        "quantity": int(detail.quantity) if detail.quantity is not None else 0,
        "totalamount": to_float(detail.totalamount),
        "paidamount": to_float(detail.paidamount),
        "remainingamount": to_float(detail.remainingamount),
        "deliverydate": detail.deliverydate.isoformat() if detail.deliverydate else None,
        "status": "Đã giao" if is_delivered else "Chưa giao",
    }


def _serialize_service_payment(payment: ServicePayment):
    return {
        "paymentid": payment.servicepaymentid,
        "amount": to_float(payment.amount),
        "paymentdate": payment.paymentdate.isoformat() if payment.paymentdate else None,
        "note": payment.note,
    }


def _serialize_service_invoice(invoice: ServiceInvoice, include_details: bool = False):
    ordered_details = sorted(invoice.details, key=lambda detail: detail.serviceinvoicedetailid or 0)
    is_completed = bool(ordered_details) and all(detail.deliverydate for detail in ordered_details)
    service_names = [detail.servicetype.servicename for detail in ordered_details if detail.servicetype and detail.servicetype.servicename]
    payload = {
        "invoiceid": invoice.serviceinvoiceid,
        "invoicecode": format_code("PDV", invoice.serviceinvoiceid),
        "invoicedate": invoice.createddate.isoformat() if invoice.createddate else None,
        "customerid": invoice.customerid,
        "customercode": format_code("KH", invoice.customerid),
        "customername": invoice.customer.customername if invoice.customer else None,
        "customerphonenumber": invoice.customer.phonenumber if invoice.customer else None,
        "totalamount": to_float(invoice.totalamount),
        "totalpaid": to_float(invoice.totalpaid),
        "remainingamount": to_float(invoice.remainingamount),
        "status": invoice.status or ("Hoàn thành" if is_completed else "Chưa hoàn thành"),
        "itemcount": len(ordered_details),
        "servicenames": service_names,
        "servicenamesummary": ", ".join(service_names),
    }
    if include_details:
        payload["details"] = [_serialize_service_invoice_detail(detail) for detail in ordered_details]
        payload["payments"] = [
            _serialize_service_payment(payment)
            for payment in sorted(invoice.payments, key=lambda payment: payment.servicepaymentid or 0)
        ]
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
    log_action(db, current_employee.employeeid, "CREATE", "ServiceInvoice", invoice.serviceinvoiceid, f"Tạo phiếu dịch vụ {format_code('PDV', invoice.serviceinvoiceid)}")
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
    log_action(db, current_employee.employeeid, "UPDATE", "ServiceInvoice", invoice_id, f"Cập nhật phiếu dịch vụ {format_code('PDV', invoice_id)}")
    return _serialize_service_invoice(updated_invoice, include_details=True)


@router.post("/{invoice_id}/payments", status_code=status.HTTP_201_CREATED)
def create_service_payment(
    invoice_id: int,
    payload: ServicePaymentPayload,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    invoice = _get_service_invoice_or_404(invoice_id, db)
    amount = _to_money(payload.amount)
    remaining_amount = _to_money(invoice.remainingamount or 0)
    if amount > remaining_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Số tiền thanh toán không được lớn hơn khoản còn lại",
        )

    payment = ServicePayment(
        serviceinvoiceid=invoice_id,
        amount=amount,
        paymentdate=payload.paymentdate,
        note=payload.note.strip() if payload.note else None,
    )
    invoice.totalpaid = (_to_money(invoice.totalpaid or 0) + amount).quantize(Decimal("0.01"))
    invoice.remainingamount = (remaining_amount - amount).quantize(Decimal("0.01"))
    db.add(payment)
    db.commit()
    updated_invoice = _get_service_invoice_or_404(invoice_id, db)
    log_action(db, current_employee.employeeid, "PAYMENT", "ServiceInvoice", invoice_id, f"Ghi nhận thanh toán phiếu dịch vụ {format_code('PDV', invoice_id)}")
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
    for payment in db.query(ServicePayment).filter(ServicePayment.serviceinvoiceid == invoice_id).all():
        db.delete(payment)

    db.delete(invoice)
    db.commit()
    log_action(db, current_employee.employeeid, "DELETE", "ServiceInvoice", invoice_id, f"Xóa phiếu dịch vụ {format_code('PDV', invoice_id)}")

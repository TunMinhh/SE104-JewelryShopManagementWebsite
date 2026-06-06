from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.deps import format_code, get_db, get_current_employee, require_admin, to_float
from app.models.employee import Employee
from app.models.servicetype import ServiceType

router = APIRouter()


class ServiceTypePayload(BaseModel):
    servicename: str
    defaultserviceprice: float = Field(ge=0)


def _serialize_service_type(service_type: ServiceType):
    return {
        "servicetypeid": service_type.servicetypeid,
        "servicetypecode": format_code("DV", service_type.servicetypeid),
        "servicename": service_type.servicename,
        "defaultserviceprice": to_float(service_type.defaultserviceprice),
    }


def _get_service_type_or_404(service_type_id: int, db: Session):
    service_type = db.query(ServiceType).filter(ServiceType.servicetypeid == service_type_id).first()
    if not service_type:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service type not found")
    return service_type


def _validate_service_type_name(name: str, db: Session, service_type_id: int | None = None):
    service_name = name.strip()
    if not service_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Service type name is required")

    query = db.query(ServiceType).filter(ServiceType.servicename == service_name)
    if service_type_id is not None:
        query = query.filter(ServiceType.servicetypeid != service_type_id)
    if query.first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Service type name already exists")
    return service_name


@router.get("")
@router.get("/", include_in_schema=False)
def list_service_types(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    service_types = db.query(ServiceType).order_by(ServiceType.servicetypeid.asc()).all()
    return [_serialize_service_type(service_type) for service_type in service_types]


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", include_in_schema=False, status_code=status.HTTP_201_CREATED)
def create_service_type(
    payload: ServiceTypePayload,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    service_type = ServiceType(
        servicename=_validate_service_type_name(payload.servicename, db),
        defaultserviceprice=payload.defaultserviceprice,
    )
    db.add(service_type)
    db.commit()
    db.refresh(service_type)
    return _serialize_service_type(service_type)


@router.put("/{service_type_id}")
def update_service_type(
    service_type_id: int,
    payload: ServiceTypePayload,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    service_type = _get_service_type_or_404(service_type_id, db)
    service_type.servicename = _validate_service_type_name(payload.servicename, db, service_type_id)
    service_type.defaultserviceprice = payload.defaultserviceprice
    db.commit()
    db.refresh(service_type)
    return _serialize_service_type(service_type)


@router.delete("/{service_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service_type(
    service_type_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    service_type = _get_service_type_or_404(service_type_id, db)
    if service_type.invoice_details:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete service type that already appears in service invoices",
        )
    db.delete(service_type)
    db.commit()

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import format_code, get_db, get_current_employee, to_float
from app.models.employee import Employee
from app.models.servicetype import ServiceType

router = APIRouter()


def _serialize_service_type(service_type: ServiceType):
    return {
        "servicetypeid": service_type.servicetypeid,
        "servicetypecode": format_code("DV", service_type.servicetypeid),
        "servicename": service_type.servicename,
        "defaultserviceprice": to_float(service_type.defaultserviceprice),
    }


@router.get("")
@router.get("/", include_in_schema=False)
def list_service_types(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    service_types = db.query(ServiceType).order_by(ServiceType.servicetypeid.asc()).all()
    return [_serialize_service_type(service_type) for service_type in service_types]

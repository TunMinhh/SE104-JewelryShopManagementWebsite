from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth import decode_access_token
from app.database import SessionLocal
from app.models.employee import Employee
from app.models.servicetype import ServiceType

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


def _to_float(value):
    return float(value) if value is not None else 0.0


def _serialize_service_type(service_type: ServiceType):
    return {
        "servicetypeid": service_type.servicetypeid,
        "servicename": service_type.servicename,
        "defaultserviceprice": _to_float(service_type.defaultserviceprice),
    }


@router.get("")
@router.get("/", include_in_schema=False)
def list_service_types(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    service_types = db.query(ServiceType).order_by(ServiceType.servicename.asc(), ServiceType.servicetypeid.asc()).all()
    return [_serialize_service_type(service_type) for service_type in service_types]
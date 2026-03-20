from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import decode_access_token
from app.database import SessionLocal
from app.models.employee import Employee
from app.models.supplier import Supplier

router = APIRouter()
security = HTTPBearer(auto_error=False)


class SupplierPayload(BaseModel):
    suppliername: str
    address: str | None = None
    phonenumber: str | None = None


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


def _serialize_supplier(supplier: Supplier):
    return {
        "supplierid": supplier.supplierid,
        "suppliername": supplier.suppliername,
        "address": supplier.address,
        "phonenumber": supplier.phonenumber,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", include_in_schema=False, status_code=status.HTTP_201_CREATED)
def create_supplier(
    payload: SupplierPayload,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    supplier_name = payload.suppliername.strip()
    address = payload.address.strip() if payload.address else None
    phone_number = payload.phonenumber.strip() if payload.phonenumber else None

    if not supplier_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supplier name is required",
        )

    if phone_number:
        existing_supplier = db.query(Supplier).filter(Supplier.phonenumber == phone_number).first()
        if existing_supplier:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Phone number already belongs to an existing supplier",
            )

    supplier = Supplier(
        suppliername=supplier_name,
        address=address,
        phonenumber=phone_number,
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return _serialize_supplier(supplier)


@router.get("")
@router.get("/", include_in_schema=False)
def list_suppliers(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    suppliers = db.query(Supplier).all()
    return [_serialize_supplier(supplier) for supplier in suppliers]


@router.get("/{supplier_id}")
def get_supplier(supplier_id: int, db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    supplier = db.query(Supplier).filter(Supplier.supplierid == supplier_id).first()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found",
        )
    return _serialize_supplier(supplier)
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.auth import decode_access_token
from app.database import SessionLocal
from app.models.customer import Customer
from app.models.employee import Employee

router = APIRouter()
security = HTTPBearer(auto_error=False)


class CustomerPayload(BaseModel):
    customername: str
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


def _serialize_customer(customer: Customer):
    return {
        "customerid": customer.customerid,
        "customername": customer.customername,
        "phonenumber": customer.phonenumber,
    }


def _get_customer_or_404(customer_id: int, db: Session):
    customer = db.query(Customer).filter(Customer.customerid == customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )
    return customer


@router.get("")
@router.get("/", include_in_schema=False)
def list_customers(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    customers = db.query(Customer).all()
    return [_serialize_customer(customer) for customer in customers]


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", include_in_schema=False, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerPayload,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    customer_name = payload.customername.strip()
    phone_number = payload.phonenumber.strip() if payload.phonenumber else None

    if not customer_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Customer name is required",
        )

    if phone_number:
        existing_customer = db.query(Customer).filter(Customer.phonenumber == phone_number).first()
        if existing_customer:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Phone number already belongs to an existing customer",
            )

    customer = Customer(
        customername=customer_name,
        phonenumber=phone_number,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return _serialize_customer(customer)


@router.put("/{customer_id}")
def update_customer(
    customer_id: int,
    payload: CustomerPayload,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    customer = _get_customer_or_404(customer_id, db)

    customer_name = payload.customername.strip()
    phone_number = payload.phonenumber.strip() if payload.phonenumber else None

    if not customer_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Customer name is required",
        )

    if phone_number:
        existing_customer = (
            db.query(Customer)
            .filter(Customer.phonenumber == phone_number, Customer.customerid != customer_id)
            .first()
        )
        if existing_customer:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Phone number already belongs to an existing customer",
            )

    customer.customername = customer_name
    customer.phonenumber = phone_number
    db.commit()
    db.refresh(customer)
    return _serialize_customer(customer)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    customer = _get_customer_or_404(customer_id, db)

    if customer.salesinvoices or customer.serviceinvoices:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete customer that already has invoices",
        )

    db.delete(customer)
    db.commit()


@router.get("/count")
def count_customers(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    count = db.query(func.count(Customer.customerid)).scalar()
    return {"count": count or 0}


@router.get("/{customer_id}")
def get_customer(customer_id: int, db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    customer = _get_customer_or_404(customer_id, db)
    return _serialize_customer(customer)

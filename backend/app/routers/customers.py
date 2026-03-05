from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.auth import decode_access_token
from app.database import SessionLocal
from app.models.customer import Customer
from app.models.employee import Employee

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


@router.get("/")
def list_customers(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    customers = db.query(Customer).all()
    return [
        {
            "customerid": c.customerid,
            "customername": c.customername,
            "phonenumber": c.phonenumber,
        }
        for c in customers
    ]


@router.get("/count")
def count_customers(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    count = db.query(func.count(Customer.customerid)).scalar()
    return {"count": count or 0}


@router.get("/{customer_id}")
def get_customer(customer_id: int, db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    customer = db.query(Customer).filter(Customer.customerid == customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )
    return {
        "customerid": customer.customerid,
        "customername": customer.customername,
        "phonenumber": customer.phonenumber,
    }

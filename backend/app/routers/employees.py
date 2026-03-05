from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth import decode_access_token
from app.database import SessionLocal
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
def list_employees(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    employees = db.query(Employee).all()
    return [
        {
            "employeeid": e.employeeid,
            "employeename": e.employeename,
            "username": e.username,
            "roleid": e.roleid,
        }
        for e in employees
    ]


@router.get("/{employee_id}")
def get_employee(employee_id: int, db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    employee = db.query(Employee).filter(Employee.employeeid == employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    return {
        "employeeid": employee.employeeid,
        "employeename": employee.employeename,
        "username": employee.username,
        "roleid": employee.roleid,
    }

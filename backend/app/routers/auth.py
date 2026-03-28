from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import create_access_token, decode_access_token, verify_password
from app.deps import get_db
from app.models.employee import Employee
from app.models.role import Role

router = APIRouter()
security = HTTPBearer(auto_error=False)


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    employeeid: int
    employeename: str
    roleid: int
    rolename: str


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    employee = (
        db.query(Employee)
        .join(Role, Role.roleid == Employee.roleid)
        .filter(Employee.username == payload.username)
        .first()
    )

    if not employee or not verify_password(payload.password, employee.passwordhash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    access_token = create_access_token(
        {
            "sub": str(employee.employeeid),
            "username": employee.username,
            "roleid": employee.roleid,
        }
    )

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        employeeid=employee.employeeid,
        employeename=employee.employeename,
        roleid=employee.roleid,
        rolename=employee.role.rolename if employee.role else "Employee",
    )


@router.get("/me")
def me(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
):
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")

    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    employee = (
        db.query(Employee)
        .join(Role, Role.roleid == Employee.roleid)
        .filter(Employee.employeeid == int(payload["sub"]))
        .first()
    )
    if not employee:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return {
        "employeeid": employee.employeeid,
        "username": employee.username,
        "employeename": employee.employeename,
        "roleid": employee.roleid,
        "rolename": employee.role.rolename if employee.role else "Employee",
    }

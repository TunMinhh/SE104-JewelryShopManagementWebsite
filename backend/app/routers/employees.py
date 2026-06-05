from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import hash_password
from app.deps import format_code, get_db, require_admin, log_action
from app.models.employee import Employee
from app.models.role import Role

router = APIRouter()


class EmployeePayload(BaseModel):
    employeename: str
    username: str
    roleid: int
    password: str | None = None


def _serialize_employee(employee: Employee):
    return {
        "employeeid": employee.employeeid,
        "employeecode": format_code("NV", employee.employeeid),
        "employeename": employee.employeename,
        "username": employee.username,
        "roleid": employee.roleid,
        "rolename": employee.role.rolename if employee.role else None,
    }


def _get_employee_or_404(employee_id: int, db: Session):
    employee = db.query(Employee).filter(Employee.employeeid == employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    return employee


def _validate_employee_payload(payload: EmployeePayload, db: Session, employee_id: int | None = None):
    employee_name = payload.employeename.strip()
    username = payload.username.strip()

    if not employee_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee name is required",
        )

    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is required",
        )

    role = db.query(Role).filter(Role.roleid == payload.roleid).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )

    username_query = db.query(Employee).filter(Employee.username == username)
    if employee_id is not None:
        username_query = username_query.filter(Employee.employeeid != employee_id)
    existing_username = username_query.first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists",
        )

    return employee_name, username, role


@router.get("")
@router.get("/", include_in_schema=False)
def list_employees(db: Session = Depends(get_db), current_employee: Employee = Depends(require_admin)):
    employees = db.query(Employee).join(Role, Role.roleid == Employee.roleid).order_by(Employee.employeeid.asc()).all()
    return [_serialize_employee(employee) for employee in employees]


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", include_in_schema=False, status_code=status.HTTP_201_CREATED)
def create_employee(
    payload: EmployeePayload,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    employee_name, username, _ = _validate_employee_payload(payload, db)

    if not payload.password or not payload.password.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is required",
        )

    employee = Employee(
        employeename=employee_name,
        username=username,
        passwordhash=hash_password(payload.password.strip()),
        roleid=payload.roleid,
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)
    log_action(db, current_employee.employeeid, "CREATE", "Employee", employee.employeeid, f"Thêm nhân viên '{employee_name}'")
    return _serialize_employee(employee)


@router.get("/count")
def count_employees(db: Session = Depends(get_db), current_employee: Employee = Depends(require_admin)):
    count = db.query(func.count(Employee.employeeid)).scalar()
    return {"count": count or 0}


@router.get("/{employee_id}")
def get_employee(employee_id: int, db: Session = Depends(get_db), current_employee: Employee = Depends(require_admin)):
    employee = _get_employee_or_404(employee_id, db)
    return _serialize_employee(employee)


@router.put("/{employee_id}")
def update_employee(
    employee_id: int,
    payload: EmployeePayload,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    employee = _get_employee_or_404(employee_id, db)
    employee_name, username, _ = _validate_employee_payload(payload, db, employee_id=employee_id)

    employee.employeename = employee_name
    employee.username = username
    employee.roleid = payload.roleid
    if payload.password and payload.password.strip():
        employee.passwordhash = hash_password(payload.password.strip())

    db.commit()
    db.refresh(employee)
    log_action(db, current_employee.employeeid, "UPDATE", "Employee", employee_id, f"Cập nhật nhân viên '{employee_name}'")
    return _serialize_employee(employee)


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    employee = _get_employee_or_404(employee_id, db)

    if employee.employeeid == current_employee.employeeid:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete the current logged in employee",
        )

    deleted_name = employee.employeename
    deleted_id = employee.employeeid
    db.delete(employee)
    db.commit()
    log_action(db, current_employee.employeeid, "DELETE", "Employee", deleted_id, f"Xóa nhân viên '{deleted_name}'")

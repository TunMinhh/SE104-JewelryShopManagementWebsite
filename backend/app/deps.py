from typing import List

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth import decode_access_token
from app.database import SessionLocal
from app.models.employee import Employee

security = HTTPBearer(auto_error=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_employee(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
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


def require_roles(allowed_roles: List[str]):
    """Return a dependency that checks the current employee's role against *allowed_roles*."""

    def _guard(
        current_employee: Employee = Depends(get_current_employee),
        db: Session = Depends(get_db),
    ):
        role = current_employee.role
        if not role or role.rolename not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource",
            )
        return current_employee

    return _guard


# Convenience shortcuts
require_admin = require_roles(["Admin"])
require_any = require_roles(["Admin", "Employee"])


def to_float(value):
    return float(value) if value is not None else 0.0


def log_action(db: Session, employee_id: int, action: str, resource: str, resource_id=None, detail: str | None = None):
    from datetime import datetime, timezone
    from app.models.auditlog import AuditLog

    entry = AuditLog(
        employeeid=employee_id,
        action=action,
        resource=resource,
        resourceid=str(resource_id) if resource_id is not None else None,
        detail=detail,
        timestamp=datetime.now(timezone.utc),
    )
    db.add(entry)
    db.commit()

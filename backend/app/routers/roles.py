from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import get_db, get_current_employee
from app.models.employee import Employee
from app.models.role import Role

router = APIRouter()


@router.get("")
@router.get("/", include_in_schema=False)
def list_roles(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    roles = db.query(Role).order_by(Role.roleid.asc()).all()
    return [{"roleid": role.roleid, "rolename": role.rolename} for role in roles]
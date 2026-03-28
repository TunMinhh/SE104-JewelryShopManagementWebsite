from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.deps import get_db, require_admin
from app.models.auditlog import AuditLog
from app.models.employee import Employee

router = APIRouter()


@router.get("")
@router.get("/", include_in_schema=False)
def list_audit_logs(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    logs = (
        db.query(AuditLog)
        .order_by(desc(AuditLog.timestamp))
        .offset(skip)
        .limit(limit)
        .all()
    )

    results = []
    for log in logs:
        results.append({
            "logid": log.logid,
            "employeeid": log.employeeid,
            "employeename": log.employee.employeename if log.employee else None,
            "action": log.action,
            "resource": log.resource,
            "resourceid": log.resourceid,
            "detail": log.detail,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        })

    return results


@router.get("/count")
def count_audit_logs(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    from sqlalchemy import func
    count = db.query(func.count(AuditLog.logid)).scalar()
    return {"count": count or 0}

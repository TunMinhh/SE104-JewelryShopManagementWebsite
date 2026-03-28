from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class AuditLog(Base):
    __tablename__ = "auditlog"

    logid = Column(Integer, primary_key=True, index=True, autoincrement=True)
    employeeid = Column(Integer, ForeignKey("employee.employeeid"), nullable=False)
    action = Column(String(50), nullable=False)
    resource = Column(String(100), nullable=False)
    resourceid = Column(String(50), nullable=True)
    detail = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), nullable=False)

    employee = relationship("Employee")

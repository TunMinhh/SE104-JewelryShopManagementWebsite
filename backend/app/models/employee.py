from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class Employee(Base):
    __tablename__ = "employee"

    employeeid = Column(Integer, primary_key=True, index=True)
    employeename = Column(String)
    username = Column(String)
    passwordhash = Column(String)

    roleid = Column(Integer, ForeignKey("role.roleid"), nullable=False)

    role = relationship("Role", back_populates="employees")
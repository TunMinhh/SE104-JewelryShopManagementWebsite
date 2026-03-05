from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base

class Role(Base):
    __tablename__ = "role"

    roleid = Column(Integer, primary_key=True, index=True)
    rolename = Column(String)

    employees = relationship("Employee", back_populates="role")
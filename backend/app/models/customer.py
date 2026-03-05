from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base

class Customer(Base):
    __tablename__ = "customer"

    customerid = Column(Integer, primary_key=True, index=True)
    customername = Column(String)
    phonenumber = Column(String)

    salesinvoices = relationship("SalesInvoice", back_populates="customer")
    serviceinvoices = relationship("ServiceInvoice", back_populates="customer")
from sqlalchemy import Column, Integer, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class SalesInvoice(Base):
    __tablename__ = "salesinvoice"

    salesinvoiceid = Column(Integer, primary_key=True, index=True)
    createddate = Column(Date, nullable=False)

    customerid = Column(Integer, ForeignKey("customer.customerid"), nullable=False)

    # relationship
    customer = relationship("Customer", back_populates="salesinvoices")
    details = relationship("SalesInvoiceDetail", back_populates="invoice", cascade="all, delete-orphan")
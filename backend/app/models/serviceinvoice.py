from sqlalchemy import Column, Integer, Date, Numeric, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class ServiceInvoice(Base):
    __tablename__ = "serviceinvoice"

    serviceinvoiceid = Column(Integer, primary_key=True)
    createddate = Column(Date)

    customerid = Column(Integer, ForeignKey("customer.customerid"), nullable=False)

    totalamount = Column(Numeric)
    totalpaid = Column(Numeric)
    remainingamount = Column(Numeric)

    status = Column(String)

    customer = relationship("Customer", back_populates="serviceinvoices")
    details = relationship("ServiceInvoiceDetail", back_populates="invoice", cascade="all, delete-orphan")

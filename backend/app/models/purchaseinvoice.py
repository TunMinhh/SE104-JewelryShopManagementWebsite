from sqlalchemy import Column, Integer, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class PurchaseInvoice(Base):
    __tablename__ = "purchaseinvoice"

    purchaseinvoiceid = Column(Integer, primary_key=True)
    createddate = Column(Date)

    supplierid = Column(Integer, ForeignKey("supplier.supplierid"), nullable=False)

    supplier = relationship("Supplier", back_populates="purchaseinvoices")
    details = relationship("PurchaseInvoiceDetail", back_populates="invoice", cascade="all, delete-orphan")
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base


class Supplier(Base):
    __tablename__ = "supplier"

    supplierid = Column(Integer, primary_key=True)
    suppliername = Column(String)
    address = Column(String)
    phonenumber = Column(String)

    purchaseinvoices = relationship("PurchaseInvoice", back_populates="supplier")

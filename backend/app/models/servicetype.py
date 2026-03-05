from sqlalchemy import Column, Integer, String, Numeric
from sqlalchemy.orm import relationship
from app.database import Base

class ServiceType(Base):
    __tablename__ = "servicetype"

    servicetypeid = Column(Integer, primary_key=True)
    servicename = Column(String)
    defaultserviceprice = Column(Numeric)

    invoice_details = relationship("ServiceInvoiceDetail", back_populates="servicetype")
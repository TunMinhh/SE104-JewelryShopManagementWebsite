from sqlalchemy import Column, Integer, Numeric, Date, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class ServiceInvoiceDetail(Base):
    __tablename__ = "serviceinvoicedetail"

    serviceinvoicedetailid = Column(Integer, primary_key=True)

    serviceinvoiceid = Column(Integer, ForeignKey("serviceinvoice.serviceinvoiceid"), nullable=False)
    servicetypeid = Column(Integer, ForeignKey("servicetype.servicetypeid"), nullable=False)

    defaultprice = Column(Numeric)
    actualprice = Column(Numeric)

    quantity = Column(Numeric)

    totalamount = Column(Numeric)

    paidamount = Column(Numeric)
    remainingamount = Column(Numeric)

    deliverydate = Column(Date)

    invoice = relationship("ServiceInvoice", back_populates="details")
    servicetype = relationship("ServiceType", back_populates="invoice_details")
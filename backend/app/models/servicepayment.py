from sqlalchemy import Column, Date, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship

from app.database import Base


class ServicePayment(Base):
    __tablename__ = "servicepayment"

    servicepaymentid = Column(Integer, primary_key=True)
    serviceinvoiceid = Column(Integer, ForeignKey("serviceinvoice.serviceinvoiceid"), nullable=False)
    amount = Column(Numeric, nullable=False)
    paymentdate = Column(Date, nullable=False)
    note = Column(String)

    invoice = relationship("ServiceInvoice", back_populates="payments")

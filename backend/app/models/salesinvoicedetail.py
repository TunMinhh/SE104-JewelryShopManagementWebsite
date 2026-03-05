from sqlalchemy import Column, Integer, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class SalesInvoiceDetail(Base):
    __tablename__ = "salesinvoicedetail"

    salesinvoicedetailid = Column(Integer, primary_key=True)

    salesinvoiceid = Column(Integer, ForeignKey("salesinvoice.salesinvoiceid"), nullable=False)
    productid = Column(Integer, ForeignKey("product.productid"), nullable=False)

    quantity = Column(Numeric)
    sellingprice = Column(Numeric)
    totalamount = Column(Numeric)

    invoice = relationship("SalesInvoice", back_populates="details")
    product = relationship("Product", back_populates="sales_details")
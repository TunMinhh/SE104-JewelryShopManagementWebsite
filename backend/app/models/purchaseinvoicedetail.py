from sqlalchemy import Column, Integer, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class PurchaseInvoiceDetail(Base):
    __tablename__ = "purchaseinvoicedetail"

    purchaseinvoicedetailid = Column(Integer, primary_key=True)

    purchaseinvoiceid = Column(Integer, ForeignKey("purchaseinvoice.purchaseinvoiceid"), nullable=False)
    productid = Column(Integer, ForeignKey("product.productid"), nullable=False)

    quantity = Column(Numeric)
    purchaseprice = Column(Numeric)
    totalamount = Column(Numeric)

    invoice = relationship("PurchaseInvoice", back_populates="details")
    product = relationship("Product", back_populates="purchase_details")

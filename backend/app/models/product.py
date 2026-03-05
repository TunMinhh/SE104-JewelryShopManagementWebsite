from sqlalchemy import Column, Integer, String, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class Product(Base):
    __tablename__ = "product"

    productid = Column(Integer, primary_key=True)
    productname = Column(String)

    productcategoryid = Column(Integer, ForeignKey("productcategory.productcategoryid"), nullable=False)

    purchaseprice = Column(Numeric)
    description = Column(String)
    unitofmeasure = Column(String)
    imageurl = Column(String)

    category = relationship("ProductCategory", back_populates="products")
    purchase_details = relationship("PurchaseInvoiceDetail", back_populates="product")
    sales_details = relationship("SalesInvoiceDetail", back_populates="product")
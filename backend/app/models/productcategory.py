from sqlalchemy import Column, Integer, String, Numeric
from sqlalchemy.orm import relationship
from app.database import Base

class ProductCategory(Base):
    __tablename__ = "productcategory"

    productcategoryid = Column(Integer, primary_key=True)
    categoryname = Column(String)
    profitpercentage = Column(Numeric)

    products = relationship("Product", back_populates="category")
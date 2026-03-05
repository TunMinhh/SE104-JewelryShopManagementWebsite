from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth import decode_access_token
from app.database import SessionLocal
from app.models.product import Product
from app.models.employee import Employee

router = APIRouter()
security = HTTPBearer(auto_error=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_employee(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    
    token_data = decode_access_token(credentials.credentials)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    
    employee = db.query(Employee).filter(Employee.employeeid == int(token_data["sub"])).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    return employee


@router.get("/")
def list_products(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    products = db.query(Product).all()
    return [
        {
            "productid": p.productid,
            "productname": p.productname,
            "categoryid": p.productcategoryid,
            "purchaseprice": float(p.purchaseprice) if p.purchaseprice else 0,
            "description": p.description,
        }
        for p in products
    ]


@router.get("/{product_id}")
def get_product(product_id: int, db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    product = db.query(Product).filter(Product.productid == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )
    return {
        "productid": product.productid,
        "productname": product.productname,
        "categoryid": product.productcategoryid,
        "purchaseprice": float(product.purchaseprice) if product.purchaseprice else 0,
        "description": product.description,
        "categoryid": product.categoryid,
        "quantity": product.quantity,
        "price": float(product.price) if product.price else 0,
    }

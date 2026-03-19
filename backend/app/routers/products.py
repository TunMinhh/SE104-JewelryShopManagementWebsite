from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session, joinedload

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


@router.get("")
@router.get("/", include_in_schema=False)
def list_products(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    products = db.query(Product).options(joinedload(Product.category)).all()
    return [
        {
            "productid": p.productid,
            "productname": p.productname,
            "categoryid": p.productcategoryid,
            "categoryname": p.category.categoryname if p.category else None,
            "purchaseprice": float(p.purchaseprice) if p.purchaseprice else 0,
            "unitofmeasure": p.unitofmeasure,
            "description": p.description,
            "recommendedprice": float(
                p.purchaseprice * (1 + (((p.category.profitpercentage if p.category else 0) or 0) / 100))
            ) if p.purchaseprice else 0,
        }
        for p in products
    ]


@router.get("/{product_id}")
def get_product(product_id: int, db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    product = db.query(Product).options(joinedload(Product.category)).filter(Product.productid == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )
    return {
        "productid": product.productid,
        "productname": product.productname,
        "categoryid": product.productcategoryid,
        "categoryname": product.category.categoryname if product.category else None,
        "purchaseprice": float(product.purchaseprice) if product.purchaseprice else 0,
        "unitofmeasure": product.unitofmeasure,
        "description": product.description,
        "recommendedprice": float(
            product.purchaseprice * (1 + (((product.category.profitpercentage if product.category else 0) or 0) / 100))
        ) if product.purchaseprice else 0,
    }

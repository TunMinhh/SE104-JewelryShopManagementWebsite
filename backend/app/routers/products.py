from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.auth import decode_access_token
from app.database import SessionLocal
from app.models.product import Product
from app.models.employee import Employee
from app.models.productcategory import ProductCategory

router = APIRouter()
security = HTTPBearer(auto_error=False)


class ProductPayload(BaseModel):
    productname: str
    categoryid: int
    purchaseprice: float = Field(ge=0)
    unitofmeasure: str
    description: str | None = None


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


def _serialize_product(product: Product):
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


def _get_product_or_404(product_id: int, db: Session):
    product = db.query(Product).options(joinedload(Product.category)).filter(Product.productid == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )
    return product


def _validate_product_payload(payload: ProductPayload, db: Session, product_id: int | None = None):
    product_name = payload.productname.strip()
    unit_of_measure = payload.unitofmeasure.strip()
    description = payload.description.strip() if payload.description else None

    if not product_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product name is required",
        )

    if not unit_of_measure:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unit of measure is required",
        )

    category = db.query(ProductCategory).filter(ProductCategory.productcategoryid == payload.categoryid).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product category not found",
        )

    product_query = db.query(Product).filter(Product.productname == product_name)
    if product_id is not None:
        product_query = product_query.filter(Product.productid != product_id)
    existing_product = product_query.first()
    if existing_product:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Product name already exists",
        )

    return product_name, unit_of_measure, description, category


@router.get("")
@router.get("/", include_in_schema=False)
def list_products(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    products = db.query(Product).options(joinedload(Product.category)).all()
    return [_serialize_product(product) for product in products]


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", include_in_schema=False, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductPayload,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    product_name, unit_of_measure, description, _ = _validate_product_payload(payload, db)

    product = Product(
        productname=product_name,
        productcategoryid=payload.categoryid,
        purchaseprice=payload.purchaseprice,
        unitofmeasure=unit_of_measure,
        description=description,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    created_product = _get_product_or_404(product.productid, db)
    return _serialize_product(created_product)


@router.get("/count")
def count_products(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    count = db.query(func.count(Product.productid)).scalar()
    return {"count": count or 0}


@router.get("/{product_id}")
def get_product(product_id: int, db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    product = _get_product_or_404(product_id, db)
    return _serialize_product(product)


@router.put("/{product_id}")
def update_product(
    product_id: int,
    payload: ProductPayload,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    product = _get_product_or_404(product_id, db)
    product_name, unit_of_measure, description, _ = _validate_product_payload(payload, db, product_id=product_id)

    product.productname = product_name
    product.productcategoryid = payload.categoryid
    product.purchaseprice = payload.purchaseprice
    product.unitofmeasure = unit_of_measure
    product.description = description

    db.commit()
    db.refresh(product)
    updated_product = _get_product_or_404(product_id, db)
    return _serialize_product(updated_product)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    product = _get_product_or_404(product_id, db)

    if product.purchase_details or product.sales_details:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete product that already appears in invoices",
        )

    db.delete(product)
    db.commit()

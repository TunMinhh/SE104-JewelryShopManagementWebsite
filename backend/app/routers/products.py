from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.deps import format_code, get_db, get_current_employee, require_admin, log_action
from app.models.product import Product
from app.models.employee import Employee
from app.models.productcategory import ProductCategory
from app.models.purchaseinvoicedetail import PurchaseInvoiceDetail
from app.models.salesinvoicedetail import SalesInvoiceDetail

router = APIRouter()


class ProductPayload(BaseModel):
    productname: str
    categoryid: int
    purchaseprice: float = Field(ge=0)
    description: str | None = None


def _build_quantity_map(query_results):
    return {
        product_id: float(quantity or 0)
        for product_id, quantity in query_results
    }


def _get_current_quantities(db: Session):
    purchased_quantities = _build_quantity_map(
        db.query(
            PurchaseInvoiceDetail.productid,
            func.coalesce(func.sum(PurchaseInvoiceDetail.quantity), 0),
        )
        .group_by(PurchaseInvoiceDetail.productid)
        .all()
    )

    sold_quantities = _build_quantity_map(
        db.query(
            SalesInvoiceDetail.productid,
            func.coalesce(func.sum(SalesInvoiceDetail.quantity), 0),
        )
        .group_by(SalesInvoiceDetail.productid)
        .all()
    )

    product_ids = set(purchased_quantities) | set(sold_quantities)
    return {
        product_id: purchased_quantities.get(product_id, 0) - sold_quantities.get(product_id, 0)
        for product_id in product_ids
    }


def _get_current_quantity(db: Session, product_id: int):
    purchased_quantity = (
        db.query(func.coalesce(func.sum(PurchaseInvoiceDetail.quantity), 0))
        .filter(PurchaseInvoiceDetail.productid == product_id)
        .scalar()
        or 0
    )
    sold_quantity = (
        db.query(func.coalesce(func.sum(SalesInvoiceDetail.quantity), 0))
        .filter(SalesInvoiceDetail.productid == product_id)
        .scalar()
        or 0
    )
    return float(purchased_quantity) - float(sold_quantity)


def _serialize_product(product: Product, current_quantity: float = 0):
    return {
        "productid": product.productid,
        "productcode": format_code("SP", product.productid),
        "productname": product.productname,
        "categoryid": product.productcategoryid,
        "categorycode": format_code("DM", product.productcategoryid),
        "categoryname": product.category.categoryname if product.category else None,
        "purchaseprice": float(product.purchaseprice) if product.purchaseprice else 0,
        "unitofmeasure": product.category.unitofmeasure if product.category else None,
        "description": product.description,
        "currentquantity": current_quantity,
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
    description = payload.description.strip() if payload.description else None

    if not product_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product name is required",
        )

    category = db.query(ProductCategory).filter(ProductCategory.productcategoryid == payload.categoryid).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product category not found",
        )

    if not category.unitofmeasure:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product category unit of measure is required",
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

    return product_name, description, category


@router.get("")
@router.get("/", include_in_schema=False)
def list_products(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    products = db.query(Product).options(joinedload(Product.category)).order_by(Product.productid.asc()).all()
    current_quantities = _get_current_quantities(db)
    return [_serialize_product(product, current_quantities.get(product.productid, 0)) for product in products]


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", include_in_schema=False, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductPayload,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    product_name, description, _ = _validate_product_payload(payload, db)

    product = Product(
        productname=product_name,
        productcategoryid=payload.categoryid,
        purchaseprice=payload.purchaseprice,
        description=description,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    created_product = _get_product_or_404(product.productid, db)
    log_action(db, current_employee.employeeid, "CREATE", "Product", product.productid, f"Thêm sản phẩm '{product_name}'")
    return _serialize_product(created_product, _get_current_quantity(db, created_product.productid))


@router.get("/count")
def count_products(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    count = db.query(func.count(Product.productid)).scalar()
    return {"count": count or 0}


@router.get("/{product_id}")
def get_product(product_id: int, db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    product = _get_product_or_404(product_id, db)
    return _serialize_product(product, _get_current_quantity(db, product_id))


@router.put("/{product_id}")
def update_product(
    product_id: int,
    payload: ProductPayload,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    product = _get_product_or_404(product_id, db)
    product_name, description, _ = _validate_product_payload(payload, db, product_id=product_id)

    product.productname = product_name
    product.productcategoryid = payload.categoryid
    product.purchaseprice = payload.purchaseprice
    product.description = description

    db.commit()
    db.refresh(product)
    updated_product = _get_product_or_404(product_id, db)
    log_action(db, current_employee.employeeid, "UPDATE", "Product", product_id, f"Cập nhật sản phẩm '{product_name}'")
    return _serialize_product(updated_product, _get_current_quantity(db, product_id))


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    product = _get_product_or_404(product_id, db)

    if product.purchase_details or product.sales_details:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete product that already appears in invoices",
        )

    deleted_name = product.productname
    deleted_id = product.productid
    db.delete(product)
    db.commit()
    log_action(db, current_employee.employeeid, "DELETE", "Product", deleted_id, f"Xóa sản phẩm '{deleted_name}'")

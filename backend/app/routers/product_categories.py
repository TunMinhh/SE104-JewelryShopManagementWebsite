from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.deps import format_code, get_db, get_current_employee, require_admin
from app.models.employee import Employee
from app.models.productcategory import ProductCategory

router = APIRouter()


class ProductCategoryPayload(BaseModel):
    categoryname: str
    profitpercentage: float = Field(ge=0)
    unitofmeasure: str


def _serialize_category(category: ProductCategory):
    return {
        "categoryid": category.productcategoryid,
        "categorycode": format_code("DM", category.productcategoryid),
        "categoryname": category.categoryname,
        "profitpercentage": float(category.profitpercentage) if category.profitpercentage is not None else 0,
        "unitofmeasure": category.unitofmeasure,
    }


def _get_category_or_404(category_id: int, db: Session):
    category = db.query(ProductCategory).filter(ProductCategory.productcategoryid == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product category not found",
        )
    return category


def _validate_category_payload(payload: ProductCategoryPayload, db: Session, category_id: int | None = None):
    category_name = payload.categoryname.strip()
    unit_of_measure = payload.unitofmeasure.strip()

    if not category_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product category name is required",
        )

    if not unit_of_measure:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product category unit of measure is required",
        )

    category_query = db.query(ProductCategory).filter(ProductCategory.categoryname == category_name)
    if category_id is not None:
        category_query = category_query.filter(ProductCategory.productcategoryid != category_id)
    if category_query.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Product category name already exists",
        )

    return category_name, unit_of_measure


@router.get("")
@router.get("/", include_in_schema=False)
def list_product_categories(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    categories = db.query(ProductCategory).order_by(ProductCategory.productcategoryid.asc()).all()
    return [_serialize_category(category) for category in categories]


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", include_in_schema=False, status_code=status.HTTP_201_CREATED)
def create_product_category(
    payload: ProductCategoryPayload,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    category_name, unit_of_measure = _validate_category_payload(payload, db)
    category = ProductCategory(
        categoryname=category_name,
        profitpercentage=payload.profitpercentage,
        unitofmeasure=unit_of_measure,
    )

    db.add(category)
    db.commit()
    db.refresh(category)
    return _serialize_category(category)


@router.put("/{category_id}")
def update_product_category(
    category_id: int,
    payload: ProductCategoryPayload,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    category = _get_category_or_404(category_id, db)
    category_name, unit_of_measure = _validate_category_payload(payload, db, category_id=category_id)

    category.categoryname = category_name
    category.profitpercentage = payload.profitpercentage
    category.unitofmeasure = unit_of_measure

    db.commit()
    db.refresh(category)
    return _serialize_category(category)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    category = _get_category_or_404(category_id, db)
    if category.products:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete product category that already has products",
        )

    db.delete(category)
    db.commit()

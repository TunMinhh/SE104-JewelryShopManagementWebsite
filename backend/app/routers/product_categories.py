from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import get_db, get_current_employee
from app.models.employee import Employee
from app.models.productcategory import ProductCategory

router = APIRouter()


@router.get("")
@router.get("/", include_in_schema=False)
def list_product_categories(db: Session = Depends(get_db), current_employee: Employee = Depends(get_current_employee)):
    categories = db.query(ProductCategory).order_by(ProductCategory.categoryname.asc(), ProductCategory.productcategoryid.asc()).all()
    return [
        {
            "categoryid": category.productcategoryid,
            "categoryname": category.categoryname,
            "profitpercentage": float(category.profitpercentage) if category.profitpercentage is not None else 0,
        }
        for category in categories
    ]
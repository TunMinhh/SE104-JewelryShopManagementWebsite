# Import all models so that SQLAlchemy mappers are configured on startup.
from app.models.role import Role
from app.models.employee import Employee
from app.models.customer import Customer
from app.models.product import Product
from app.models.productcategory import ProductCategory
from app.models.purchaseinvoice import PurchaseInvoice
from app.models.purchaseinvoicedetail import PurchaseInvoiceDetail
from app.models.salesinvoice import SalesInvoice
from app.models.salesinvoicedetail import SalesInvoiceDetail
from app.models.serviceinvoice import ServiceInvoice
from app.models.serviceinvoicedetail import ServiceInvoiceDetail
from app.models.servicetype import ServiceType
from app.models.supplier import Supplier
from app.models.auditlog import AuditLog


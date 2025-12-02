#This module initializes the data model package for the backend.
#It imports all SQLAlchemy model classes defined in separate modules within the package,
#making them accessible from a single location.

#Importing all SQLAlchemy model classes so they can be accessed directly
from .restaurants import Restaurants
from .menu_items import MenuItems
from .customers import Customers
from .orders import Orders, OrderItems
from .payments import Payments
from .inventory_items import InventoryItems
from .staff import StaffUsers


#Controls which symbols are imported when using "from app.models import *"
__all__ = [
    "Restaurants",
    "MenuItems",
    "Customers",
    "Orders",
    "OrderItems",
    "Payments",
    "InventoryItems",
    "StaffUsers",
]

'''
Defines the SQLAlchemy model for the inventory system used by
Byte2Bite restaurants. Each record represents an ingredient or supply item
tracked at a specific restaurant location.
'''

from ..extensions import db


class InventoryItems(db.Model):
    '''
    Stores all ingredient and supply items that each restaurant tracks.
    This is used for:
        - Low stock alerts
        - Kitchen inventory checks
        - Tracking ingredient usage for menu items
        '''
    __tablename__ = "InventoryItems"

    InventoryItemID = db.Column(db.Integer, primary_key=True)
    RestaurantID = db.Column(
        db.Integer,
        db.ForeignKey("Restaurants.RestaurantID"),
        nullable=False
    )
    
    Name = db.Column(db.String(100), nullable=False)
    QuantityInStock = db.Column(db.Integer, nullable=False, default=0)
    Unit = db.Column(db.String(20))

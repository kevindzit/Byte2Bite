from ..extensions import db


class InventoryItems(db.Model):
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

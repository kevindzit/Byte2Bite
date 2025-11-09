from ..extensions import db


class MenuItems(db.Model):
    __tablename__ = 'MenuItems'
    MenuItemID = db.Column(db.Integer, primary_key=True)
    RestaurantID = db.Column(db.Integer, db.ForeignKey('Restaurants.RestaurantID'))
    Name = db.Column(db.String(100), nullable=False)
    Description = db.Column(db.Text)
    Price = db.Column(db.Numeric(10, 2), nullable=False)
    Category = db.Column(db.String(50))
    IsAvailable = db.Column(db.Boolean, default=True)
    
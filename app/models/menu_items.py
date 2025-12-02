from ..extensions import db

'''
This module defines the SQLAlchemy model for menu items in the Byte2Bite system.
Each record represents a food or drink item offered by a specific restaurant.
'''

class MenuItems(db.Model):
    __tablename__ = 'MenuItems'
    MenuItemID = db.Column(db.Integer, primary_key=True)
    RestaurantID = db.Column(db.Integer, db.ForeignKey('Restaurants.RestaurantID'))
    Name = db.Column(db.String(100), nullable=False)
    Description = db.Column(db.Text)
    Price = db.Column(db.Numeric(10, 2), nullable=False)
    Category = db.Column(db.String(50))
    IsAvailable = db.Column(db.Boolean, default=True)
    ImageURL = db.Column(db.String(500))
    

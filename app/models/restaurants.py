from ..extensions import db


class Restaurants(db.Model):
    __tablename__ = 'Restaurants'
    RestaurantID = db.Column(db.Integer, primary_key=True)
    Name = db.Column(db.String(100), nullable=False)
    Address = db.Column(db.String(255), nullable=False)
    PhoneNumber = db.Column(db.String(20))
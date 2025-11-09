from ..extensions import db


class Orders(db.Model):
    __tablename__ = 'Orders'
    OrderID = db.Column(db.Integer, primary_key=True)
    CustomerID = db.Column(db.Integer, db.ForeignKey('Customers.CustomerID'))
    RestaurantID = db.Column(db.Integer, db.ForeignKey('Restaurants.RestaurantID'))
    OrderTime = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp())
    TotalPrice = db.Column(db.Numeric(10, 2), nullable=False)
    Status = db.Column(db.String(50), default='Pending')


class OrderItems(db.Model):
    __tablename__ = 'OrderItems'
    OrderItemID = db.Column(db.Integer, primary_key=True)
    OrderID = db.Column(db.Integer, db.ForeignKey('Orders.OrderID'))
    MenuItemID = db.Column(db.Integer, db.ForeignKey('MenuItems.MenuItemID'))
    Quantity = db.Column(db.Integer, nullable=False)
    PricePerItem = db.Column(db.Numeric(10, 2), nullable=False)
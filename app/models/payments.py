from ..extensions import db

'''
Defines the SQLAlchemy model for handling payments. 
Each record represents a completed or pending
transaction associated with an order.
'''

class Payments(db.Model):
    __tablename__ = 'Payments'
    PaymentID = db.Column(db.Integer, primary_key=True)
    OrderID = db.Column(db.Integer, db.ForeignKey('Orders.OrderID'))
    Amount = db.Column(db.Numeric(10, 2), nullable=False)
    PaymentMethod = db.Column(db.String(20), nullable=False)
    PaymentTime = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp())
    TransactionID = db.Column(db.String(255))
    PaymentStatus = db.Column(db.String(20), default='pending')
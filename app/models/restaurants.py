'''
Defines the SQLAlchemy model for restaurant locations in the system.
Each record represents a restaurant that uses
Byte2Bite for online ordering, front-of-house, and kitchen operations.
'''

from ..extensions import db

class Restaurants(db.Model):
    '''
   SQLAlchemy model for the Payments table.

    Used to track financial transactions for orders placed through the system.
    This enables:
        - Order receipts
        - Transaction history
        - Payment reconciliation
        - Integration with third-party payment processors
        '''
    __tablename__ = 'Restaurants'
    RestaurantID = db.Column(db.Integer, primary_key=True)
    Name = db.Column(db.String(100), nullable=False)
    Address = db.Column(db.String(255), nullable=False)
    PhoneNumber = db.Column(db.String(20))
'''
This module defines the SQLAlchemy model for customers.
Every record represents a registered customer in the system.
'''

from ..extensions import db


class Customers(db.Model):
    '''
    This table stores all user accounts for customers using the Byte2Bite
    system.
    '''
    __tablename__ = 'Customers'
    CustomerID = db.Column(db.Integer, primary_key=True)
    FirstName = db.Column(db.String(50), nullable=False)
    LastName = db.Column(db.String(50), nullable=False)
    Email = db.Column(db.String(100), unique=True, nullable=False)
    PasswordHash = db.Column(db.String(255), nullable=False)
    PhoneNumber = db.Column(db.String(20))
    RewardsPoints = db.Column(db.Integer, nullable=False, default=0)
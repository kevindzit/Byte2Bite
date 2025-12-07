from ..extensions import db

'''
Defines the SQLAlchemy model for staff accounts used inside the system.
Staff members include cashiers, cooks, managers, and other
employees who need access to internal workings such as the kitchen display.
'''

class StaffUsers(db.Model):
    '''
    Stores login and role information for employees who access internal
    components of Byte2Bite
    '''
    __tablename__ = "StaffUsers"
    StaffID = db.Column(db.Integer, primary_key=True)
    RestaurantID = db.Column(db.Integer, db.ForeignKey("Restaurants.RestaurantID"))
    FirstName = db.Column(db.String(50), nullable=False)
    LastName = db.Column(db.String(50), nullable=False)
    Email = db.Column(db.String(120), unique=True, nullable=False)
    PasswordHash = db.Column(db.String(255), nullable=False)
    Role = db.Column(db.String(20), nullable=False, default="staff")
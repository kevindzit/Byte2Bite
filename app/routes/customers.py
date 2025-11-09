from flask import Blueprint, jsonify, request
from werkzeug.security import generate_password_hash
from ..extensions import db
from ..models import Customers


bp = Blueprint("customers", __name__)


@bp.post("/customers")
def create_customer():
    data = request.get_json(force=True)
    hashed_password = generate_password_hash(data['password'])
    new_customer = Customers(
        FirstName=data['firstName'],
        LastName=data['lastName'],
        Email=data['email'],
        PasswordHash=hashed_password,
        PhoneNumber=data.get('phoneNumber'),
        )
    db.session.add(new_customer)
    db.session.commit()
    return jsonify({'message': 'Account created successfully'}), 201




@bp.get("/customers/search")
def search_customer():
    phone = request.args.get('phone')
    if not phone:
        return jsonify({'message': 'Phone number required'}), 400
    customer = Customers.query.filter_by(PhoneNumber=phone).first()
    if not customer:
        return jsonify({'message': 'Customer not found'}), 404
    return jsonify({
        'id': customer.CustomerID,
        'firstName': customer.FirstName,
        'lastName': customer.LastName,
        'email': customer.Email,
        'phoneNumber': customer.PhoneNumber,
    })
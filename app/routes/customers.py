from flask import Blueprint, jsonify, request
from werkzeug.security import generate_password_hash, check_password_hash
from ..extensions import db
from ..models import Customers, Orders, OrderItems, MenuItems


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
        RewardsPoints=500
        )
    db.session.add(new_customer)
    db.session.commit()
    return jsonify({'message': 'Account created successfully', 'customerId': new_customer.CustomerID}), 201


@bp.post("/customers/login")
def login_customer():
    data = request.get_json(force=True)
    email = data.get('email')
    password = data.get('password')
    if not email or not password:
        return jsonify({'message': 'Email and password required'}), 400

    customer = Customers.query.filter(db.func.lower(Customers.Email) == email.lower()).first()
    if not customer or not check_password_hash(customer.PasswordHash, password):
        return jsonify({'message': 'Invalid email or password'}), 401

    return jsonify({
        'message': 'Login successful',
        'customerId': customer.CustomerID,
        'firstName': customer.FirstName,
        'lastName': customer.LastName,
        'email': customer.Email,
        'phoneNumber': customer.PhoneNumber,
        'rewardsPoints': customer.RewardsPoints,
    })




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


@bp.get("/customers/<int:customer_id>")
def get_customer_profile(customer_id: int):
    customer = Customers.query.get(customer_id)
    if not customer:
        return jsonify({'message': 'Customer not found'}), 404
    return jsonify({
        'customerId': customer.CustomerID,
        'firstName': customer.FirstName,
        'lastName': customer.LastName,
        'email': customer.Email,
        'phoneNumber': customer.PhoneNumber,
        'rewardsPoints': customer.RewardsPoints,
    })


@bp.get("/customers/<int:customer_id>/orders")
def get_customer_orders(customer_id: int):
    orders = (
        Orders.query
        .filter(Orders.CustomerID == customer_id)
        .order_by(Orders.OrderTime.desc())
        .all()
    )
    out = []
    for order in orders:
        items = (
            db.session.query(OrderItems, MenuItems.Name)
            .join(MenuItems, OrderItems.MenuItemID == MenuItems.MenuItemID)
            .filter(OrderItems.OrderID == order.OrderID)
            .all()
        )
        out.append({
            'orderId': order.OrderID,
            'status': order.Status,
            'totalPrice': str(order.TotalPrice),
            'createdAt': order.OrderTime.strftime('%Y-%m-%d %H:%M:%S') if order.OrderTime else '',
            'items': [
                {
                    'name': name,
                    'quantity': it.Quantity,
                } for it, name in items
            ]
        })
    return jsonify(out)

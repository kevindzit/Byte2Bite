from flask import Blueprint, jsonify, request
from werkzeug.security import generate_password_hash, check_password_hash
from ..extensions import db
from ..models import Customers, Orders, OrderItems, MenuItems


bp = Blueprint("customers", __name__)
"""Creates new customer account and gives default reward points."""

#Create new customer#

@bp.post("/customers")
def create_customer():
    data = request.get_json(force=True)

    #Hash password
    hashed_password = generate_password_hash(data['password'])

    #Create new customer with default reward points
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

#Customer login#

@bp.post("/customers/login")
def login_customer():
    """Authenticates a customer using email and password."""

    data = request.get_json(force=True)
    email = data.get('email')
    password = data.get('password')
    if not email or not password:
        return jsonify({'message': 'Email and password required'}), 400

    #Look up customer by email
    customer = Customers.query.filter(db.func.lower(Customers.Email) == email.lower()).first()

    #Validate password
    if not customer or not check_password_hash(customer.PasswordHash, password):
        return jsonify({'message': 'Invalid email or password'}), 401

    #Successful login
    return jsonify({
        'message': 'Login successful',
        'customerId': customer.CustomerID,
        'firstName': customer.FirstName,
        'lastName': customer.LastName,
        'email': customer.Email,
        'phoneNumber': customer.PhoneNumber,
        'rewardsPoints': customer.RewardsPoints,
    })


#Search customer by phone number#

@bp.get("/customers/search")
def search_customer():
    """Looks up a customer profile using their phone number."""

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
        'rewardsPoints': customer.RewardsPoints or 0,
    })

#Get customer profile#

@bp.get("/customers/<int:customer_id>")
def get_customer_profile(customer_id: int):
    """Returns basic profile information for a customer by ID"""
    
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

#Get customer orders#

@bp.get("/customers/<int:customer_id>/orders")
def get_customer_orders(customer_id: int):
    """Returns a list of orders placed by the customer, including items."""
    
    #Fetch orders for the customer
    orders = (
        Orders.query
        .filter(Orders.CustomerID == customer_id)
        .order_by(Orders.OrderTime.desc())
        .all()
    )

    out = []

    for order in orders:
        #Join OrderItems with MenuItems to get item names
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

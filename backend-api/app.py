from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash
from flask_cors import CORS
import decimal
import os
from google.cloud.sql.connector import Connector
import pymysql
from google.cloud import storage


os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = os.path.join(
    os.path.dirname(__file__),
    'service-account-key.json'
)

client = storage.Client()

# Initialize flask object
app = Flask(__name__)
CORS(app)

# Initialize Cloud SQL Connector (will use environment variable)
connector = Connector()

def getconn():
    conn = connector.connect(
        "carbide-ego-476119-a7:us-central1:byte2bite",
        "pymysql",
        user="byte2bite",
        password="Byte2Bite224!",
        db="byte2bite"
    )
    return conn

# Configure SQLAlchemy to use Cloud SQL
app.config['SQLALCHEMY_DATABASE_URI'] = "mysql+pymysql://"
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    "creator": getconn,
}
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

#database models
class Restaurants(db.Model):
    __tablename__ = 'Restaurants'
    RestaurantID = db.Column(db.Integer, primary_key=True)
    Name = db.Column(db.String(100), nullable=False)
    Address = db.Column(db.String(255), nullable=False)
    PhoneNumber = db.Column(db.String(20))

class MenuItems(db.Model):
    __tablename__ = 'MenuItems'
    MenuItemID = db.Column(db.Integer, primary_key=True)
    RestaurantID = db.Column(db.Integer, db.ForeignKey('Restaurants.RestaurantID'))
    Name = db.Column(db.String(100), nullable=False)
    Description = db.Column(db.Text)
    Price = db.Column(db.Numeric(10, 2), nullable=False)
    Category = db.Column(db.String(50))
    IsAvailable = db.Column(db.Boolean, default=True)
    ImageURL = db.Column(db.String(500))  # URL to menu item image

class Customers(db.Model):
    __tablename__ = 'Customers'
    CustomerID = db.Column(db.Integer, primary_key=True)
    FirstName = db.Column(db.String(50), nullable=False)
    LastName = db.Column(db.String(50), nullable=False)
    Email = db.Column(db.String(100), unique=True, nullable=False)
    PasswordHash = db.Column(db.String(255), nullable=False)
    PhoneNumber = db.Column(db.String(20))

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

class Payments(db.Model):
    __tablename__ = 'Payments'
    PaymentID = db.Column(db.Integer, primary_key=True)
    OrderID = db.Column(db.Integer, db.ForeignKey('Orders.OrderID'))
    Amount = db.Column(db.Numeric(10, 2), nullable=False)
    PaymentMethod = db.Column(db.String(20), nullable=False)
    PaymentTime = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp())

#api endpoints
@app.route('/')
def hello():
    return "API is running!"

@app.route('/api/restaurants', methods=['GET'])
def get_restaurants():
    all_restaurants = Restaurants.query.all()
    restaurant_list = [
        {"id": r.RestaurantID, "name": r.Name, "address": r.Address}
        for r in all_restaurants
    ]
    return jsonify(restaurant_list)

@app.route('/api/menu/<int:location_id>', methods=['GET'])
def get_menu(location_id):
    items = MenuItems.query.filter_by(RestaurantID=location_id, IsAvailable=True).all()
    menu_list = [
        {
            "id": item.MenuItemID,
            "name": item.Name,
            "description": item.Description,
            "price": str(item.Price),
            "category": item.Category,
            "image": item.ImageURL  # Include image URL
        }
        for item in items
    ]
    return jsonify(menu_list)

@app.route('/api/customers', methods=['POST'])
def create_customer():
    data = request.get_json()
    hashed_password = generate_password_hash(data['password'])
    new_customer = Customers(
        FirstName=data['firstName'],
        LastName=data['lastName'],
        Email=data['email'],
        PasswordHash=hashed_password,
        PhoneNumber=data['phoneNumber']
    )
    db.session.add(new_customer)
    db.session.commit()
    return jsonify({'message': 'Account created successfully'}), 201

@app.route('/api/customers/search', methods=['GET'])
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
        'phoneNumber': customer.PhoneNumber
    })

@app.route('/api/orders', methods=['POST'])
def place_order():
    data = request.get_json()

    location_id = data['locationId']
    cart_items = data['items']
    customer_id = data.get('customerId', None)

    total_price = 0
    for item in cart_items:
        #use a session to get the item, not the class directly (for multiple locations)
        menu_item = db.session.get(MenuItems, item['id'])
        if menu_item:
            total_price += menu_item.Price * item['quantity']

    new_order = Orders(
        CustomerID=customer_id,
        RestaurantID=location_id,
        TotalPrice=total_price,
        Status='Pending'
    )
    db.session.add(new_order)
    db.session.commit()

    for item in cart_items:
        menu_item = db.session.get(MenuItems, item['id'])
        if menu_item:
            order_item = OrderItems(
                OrderID=new_order.OrderID,
                MenuItemID=item['id'],
                Quantity=item['quantity'],
                PricePerItem=menu_item.Price
            )
            db.session.add(order_item)

    db.session.commit()

    # Add payment record if payment data provided
    payment_data = data.get('payment')
    if payment_data:
        new_payment = Payments(
            OrderID=new_order.OrderID,
            Amount=payment_data['amount'],
            PaymentMethod=payment_data['method']
        )
        db.session.add(new_payment)
        db.session.commit()

    return jsonify({'message': 'Order placed successfully', 'orderId': new_order.OrderID}), 201

@app.route('/api/orders/active', methods=['GET'])
def get_active_orders():
    active_orders_query = db.session.query(
        Orders, 
        Restaurants.Name
    ).join(
        Restaurants, Orders.RestaurantID == Restaurants.RestaurantID
    ).filter(
        Orders.Status.in_(['Pending', 'Preparing', 'Completed'])
    ).all()

    orders_list = []
    for order, restaurant_name in active_orders_query:
        items_query = db.session.query(
            OrderItems, 
            MenuItems.Name
        ).join(
            MenuItems, OrderItems.MenuItemID == MenuItems.MenuItemID
        ).filter(
            OrderItems.OrderID == order.OrderID
        ).all()

        items_list = [
            {"name": item_name, "quantity": order_item.Quantity}
            for order_item, item_name in items_query
        ]
        
        orders_list.append({
            "orderId": order.OrderID,
            "restaurantName": restaurant_name,
            "totalPrice": str(order.TotalPrice),
            "status": order.Status,
            "items": items_list
        })

    return jsonify(orders_list)


@app.route('/api/orders/<int:order_id>/status', methods=['PUT'])
def update_order_status(order_id):
    order = db.session.get(Orders, order_id)
    if not order:
        return jsonify({'message': 'Order not found'}), 404

    data = request.get_json()
    new_status = data.get('status')

    if new_status not in ['Pending', 'Preparing', 'Completed', 'Ready for Pickup']:
        return jsonify({'message': 'Invalid status update'}), 400

    order.Status = new_status
    db.session.commit()

    return jsonify({'message': f'Order {order_id} status updated to {new_status}'})

@app.route('/api/orders', methods=['GET'])
def get_orders():
    # Get orders for kitchen display (Pending/Preparing)
    orders = Orders.query.filter(
        Orders.Status.in_(['Pending', 'Preparing'])
    ).order_by(Orders.OrderTime).all()

    orders_list = []
    for order in orders:
        # Get customer name
        customer = db.session.get(Customers, order.CustomerID) if order.CustomerID else None
        customer_name = f"{customer.FirstName} {customer.LastName}" if customer else "Guest"

        # Get order items
        items_query = db.session.query(OrderItems, MenuItems.Name).join(
            MenuItems, OrderItems.MenuItemID == MenuItems.MenuItemID
        ).filter(OrderItems.OrderID == order.OrderID).all()

        items_str = ", ".join([
            f"{order_item.Quantity}x {name}"
            for order_item, name in items_query
        ])

        orders_list.append({
            'id': order.OrderID,
            'customer_name': customer_name,
            'items': items_str,
            'status': order.Status,
            'created_at': order.OrderTime.strftime('%Y-%m-%d %H:%M:%S') if order.OrderTime else ''
        })

    return jsonify(orders_list)

@app.route('/api/history', methods=['GET'])
def get_history():
    # Get completed orders
    orders = Orders.query.filter_by(Status='Completed').order_by(
        Orders.OrderTime.desc()
    ).limit(50).all()

    orders_list = []
    for order in orders:
        customer = db.session.get(Customers, order.CustomerID) if order.CustomerID else None
        customer_name = f"{customer.FirstName} {customer.LastName}" if customer else "Guest"

        items_query = db.session.query(OrderItems, MenuItems.Name).join(
            MenuItems, OrderItems.MenuItemID == MenuItems.MenuItemID
        ).filter(OrderItems.OrderID == order.OrderID).all()

        items_str = ", ".join([f"{order_item.Quantity}x {name}" for order_item, name in items_query])

        orders_list.append({
            'id': order.OrderID,
            'customer_name': customer_name,
            'items': items_str,
            'status': order.Status,
            'created_at': order.OrderTime.strftime('%Y-%m-%d %H:%M:%S') if order.OrderTime else ''
        })

    return jsonify(orders_list)

@app.route('/api/orders/<int:order_id>', methods=['PATCH'])
def patch_order_status(order_id):
    order = db.session.get(Orders, order_id)
    if not order:
        return jsonify({'message': 'Order not found'}), 404

    data = request.get_json()
    order.Status = data.get('status', order.Status)
    db.session.commit()

    return jsonify({'message': 'Order updated'})


if __name__ == '__main__':
    app.run(debug=True)


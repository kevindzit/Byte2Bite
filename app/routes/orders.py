from flask import Blueprint, jsonify, request
from ..services.order_service import place_order_with_items, create_stripe_order
from ..services.payment_service import verify_payment
from ..extensions import db
from sqlalchemy import func
from ..models import Orders, Customers, OrderItems, MenuItems, Restaurants, Payments
from ..config import Config


bp = Blueprint("orders", __name__)

# Helper functions for order serialization #

def _col(model, *candidates):
    """Returns the first matching column name that exists on a model."""

    for name in candidates:
        if hasattr(model, name):
            return getattr(model, name)
    raise AttributeError(f"{model.__name__} has none of: {candidates!r}")


def _attr(obj, *candidates, default=None):
    """Returns the first matching attribute name that exists on an object."""

    for name in candidates:
        if hasattr(obj, name):
            return getattr(obj, name)
    return default


def _pk_col():
    """Returns the primary key column of the Orders model."""

    return _col(Orders, "OrderID", "id", "ID")


def _status_col():
    """Returns the status column of the Orders model."""

    return _col(Orders, "Status", "status")


def _items_attr(o):
    """Return a human-readable items string like '2× Taco, 1× Burrito'."""

    order_id = _attr(o, "OrderID", "id", "ID")
    if order_id is None:
        return ""

    rows = (
        db.session.query(OrderItems, MenuItems.Name)
        .join(MenuItems, OrderItems.MenuItemID == MenuItems.MenuItemID)
        .filter(OrderItems.OrderID == order_id)
        .all()
    )

    if not rows:
        return ""

    return ", ".join(f"{oi.Quantity}× {name}" for (oi, name) in rows)


def _created_at_attr(o):
    '''Returns the created at timestamp of an order object.'''

    created = _attr(o, "CreatedAt", "created_at", "CreatedAt", "Timestamp", default=None)
    if created is None:
        created = _attr(o, "OrderTime", "order_time", default=None)
    return created


def _customer_id_attr(o):
    '''Returns the customer ID of an order object.'''

    return _attr(o, "CustomerID", "customer_id", default=None)


def _customer_name_attr(o):
    '''Returns the customer name of an order object.'''

    name = _attr(o, "CustomerName", "customer_name", "Name", default=None)
    if name:
        return name

    cust_id = _customer_id_attr(o)
    if cust_id is None:
        return ""
    try:
        row = (
            db.session.query(Customers)
            .filter(
                _col(Customers, "CustomerID", "id", "ID") == cust_id
            )
            .first()
        )
        if not row:
            return ""
        name = _attr(row, "CustomerName", "Name", "FullName", "customer_name", default=None)
        if name:
            return name
        first = _attr(row, "FirstName", "first_name", default="")
        last = _attr(row, "LastName", "last_name", default="")
        return (f"{first} {last}").strip()
    except Exception:
        return ""


def _normalize_status(s):
    '''Ensures status strings are capitalized.'''

    return (s or "").strip().capitalize()


def _serialize_order(o):
    '''Serializes an order object into a dictionary.'''

    raw_status = _attr(o, "Status", "status", default="")
    return {
        "id": _attr(o, "OrderID", "id", "ID"),
        "orderNumber": _attr(o, "LocationOrderNumber", default=_attr(o, "OrderID", "id", "ID")),
        "customer_name": _customer_name_attr(o),
        "items": _items_attr(o),
        "status": _normalize_status(raw_status),
        "created_at": _created_at_attr(o),
    }

#ROUTES#

#Get active orders#

@bp.get("/orders")
def get_active_orders():
    # Get optional restaurant_id filter from query params
    restaurant_id = request.args.get('restaurant_id', type=int)

    query = (
        db.session.query(
            Orders,
            Restaurants.Name.label("restaurant_name"),
            func.coalesce(
                Orders.CustomerName,
                func.concat(Customers.FirstName, " ", Customers.LastName)
            ).label("customer_name"),
        )
        .join(Restaurants, Orders.RestaurantID == Restaurants.RestaurantID)
        .outerjoin(Customers, Orders.CustomerID == Customers.CustomerID)
        .filter(Orders.Status.in_(["Pending", "Preparing"]))
    )

    # Filter by restaurant if specified
    if restaurant_id:
        query = query.filter(Orders.RestaurantID == restaurant_id)

    active_orders_query = query.all()
    orders_list = []
    for order, restaurant_name, customer_name in active_orders_query:
        items_query = ( #Fetch items for order
            db.session.query(OrderItems, MenuItems.Name)
            .join(MenuItems, OrderItems.MenuItemID == MenuItems.MenuItemID)
            .filter(OrderItems.OrderID == order.OrderID)
            .all()
        )

        items_list = [
            {"name": item_name, "quantity": order_item.Quantity}
            for order_item, item_name in items_query
        ]

        items_str = ", ".join(
            f"{it['quantity']}× {it['name']}" for it in items_list
        )

        orders_list.append({
            "id": order.OrderID,
            "orderId": order.OrderID,
            "orderNumber": order.LocationOrderNumber or order.OrderID,
            "restaurantName": restaurant_name,
            "customer_name": customer_name or "Guest",
            "totalPrice": str(order.TotalPrice),
            "status": order.Status,
            "items": items_str,
            "items_list": items_list,
        })

    return jsonify(orders_list)

#Create new order#

@bp.post("/orders")
def create_order():
    """Creates an order and its associated items."""
    data = request.get_json(silent=True) or {}

    location_id = data.get("locationId")
    items = data.get("items") or []
    customer_name = data.get("customerName")
    customer_id = data.get("customerId")
    points_to_redeem = data.get("pointsToRedeem", 0)

    if not location_id or not items:
        return jsonify({"error": "locationId and items are required"}), 400


    payload = {
        "locationId": location_id,
        "items": items,
        "customerId": customer_id,
        "customerName": customer_name or "Guest",
        "pointsToRedeem": points_to_redeem,
    }

    try:
        result = place_order_with_items(payload) #Create order via service
        return jsonify({
            "message": "Order created",
            "orderId": result['order_id'],
            "orderNumber": result['location_order_number']
        }), 201

    except Exception as e:
        db.session.rollback()
        print("Error in create_order:", e)
        return jsonify({"error": "Failed to create order"}), 500


#Order history#

@bp.get("/history")
def get_history():
    # Get optional restaurant_id filter from query params
    restaurant_id = request.args.get('restaurant_id', type=int)

    status_col = _status_col()
    pk = _pk_col()
    
    query = (
        Orders.query
        .filter(status_col.in_(["Completed", "Delivered"]))
    )

    # Filter by restaurant if specified
    if restaurant_id:
        query = query.filter(Orders.RestaurantID == restaurant_id)

    orders = query.order_by(pk.desc()).all()
    return jsonify([_serialize_order(o) for o in orders])

#Update order#

@bp.patch("/orders/<int:order_id>")
def update_order(order_id: int):
    """Updates an order's status."""


    data = (request.get_json(silent=True) or {})
    pk = _pk_col()
    order = Orders.query.filter(pk == order_id).first_or_404()

    new_status = data.get("status")
    if new_status is not None:
        if hasattr(order, "Status"):
            order.Status = new_status
        elif hasattr(order, "status"):
            order.status = new_status

    db.session.commit()
    return jsonify({"message": "Order updated"})

#Create Stripe payment intent#

@bp.post("/orders/stripe-payment")
def create_stripe_payment():
    """Initialize a Stripe payment and return client secret."""

    data = request.get_json(silent=True) or {}

    result = create_stripe_order(data)

    if 'error' in result:
        return jsonify(result), 400

    return jsonify(result)

#Finalize payment and confirm#

@bp.post("/orders/<int:order_id>/confirm-payment")
def confirm_payment(order_id):
    """Verify Stripe payment and update order, payment, and rewards data."""

    data = request.get_json(silent=True) or {}
    payment_intent_id = data.get('payment_intent_id')

    if not payment_intent_id:
        return jsonify({'error': 'Payment intent ID required'}), 400

    # Verify with Stripe
    if verify_payment(payment_intent_id):
        # Update order status
        order = Orders.query.get(order_id)
        if order:
            order.Status = 'Pending'

            # Update payment record
            payment = Payments.query.filter_by(OrderID=order_id, TransactionID=payment_intent_id).first()
            if payment:
                payment.PaymentStatus = 'completed'

            # Update rewards points
            if order.CustomerID:
                customer = Customers.query.get(order.CustomerID)
                if customer:
                    points_to_redeem = data.get('points_redeemed', 0)
                    points_earned = int(float(order.TotalPrice) * 10)
                    customer.RewardsPoints = (customer.RewardsPoints or 0) - points_to_redeem + points_earned

            db.session.commit()
            return jsonify({'success': True})

    return jsonify({'error': 'Payment verification failed'}), 400

#Get Stripe publishable key#
@bp.get("/stripe-key")
def get_stripe_key():
    return jsonify({'publishable_key': Config.STRIPE_PUBLISHABLE_KEY})

from flask import Blueprint, jsonify, request
from ..services.order_service import place_order_with_items
from ..extensions import db
from sqlalchemy import func
from ..models import Orders, Customers, OrderItems, MenuItems, Restaurants


bp = Blueprint("orders", __name__)


def _col(model, *candidates):
    for name in candidates:
        if hasattr(model, name):
            return getattr(model, name)
    raise AttributeError(f"{model.__name__} has none of: {candidates!r}")


def _attr(obj, *candidates, default=None):
    for name in candidates:
        if hasattr(obj, name):
            return getattr(obj, name)
    return default


def _pk_col():
    return _col(Orders, "OrderID", "id", "ID")


def _status_col():
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
    created = _attr(o, "CreatedAt", "created_at", "CreatedAt", "Timestamp", default=None)
    if created is None:
        created = _attr(o, "OrderTime", "order_time", default=None)
    return created


def _customer_id_attr(o):
    return _attr(o, "CustomerID", "customer_id", default=None)


def _customer_name_attr(o):
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
    return (s or "").strip().capitalize()


def _serialize_order(o):
    raw_status = _attr(o, "Status", "status", default="")
    return {
        "id": _attr(o, "OrderID", "id", "ID"),
        "customer_name": _customer_name_attr(o),
        "items": _items_attr(o),
        "status": _normalize_status(raw_status),
        "created_at": _created_at_attr(o),
    }


@bp.get("/orders")
def get_active_orders():
    active_orders_query = (
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
        .all()
    )
    orders_list = []
    for order, restaurant_name, customer_name in active_orders_query:
        items_query = (
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
            "restaurantName": restaurant_name,
            "customer_name": customer_name or "Guest",
            "totalPrice": str(order.TotalPrice),
            "status": order.Status,
            "items": items_str,
            "items_list": items_list,
        })

    return jsonify(orders_list)


@bp.post("/orders")
def create_order():
    data = request.get_json(silent=True) or {}

    location_id = data.get("locationId")
    items = data.get("items") or []
    customer_name = data.get("customerName")
    customer_id = data.get("customerId")  

    if not location_id or not items:
        return jsonify({"error": "locationId and items are required"}), 400


    payload = {
        "locationId": location_id,
        "items": items,
        "customerId": customer_id,
        "customerName": customer_name or "Guest",
    }

    try:

        order = place_order_with_items(payload)

        order_id = getattr(order, "OrderID", None) or getattr(order, "id", None)
        if order_id is None and isinstance(order, dict):
            order_id = order.get("orderId") or order.get("id")

        return jsonify({
            "message": "Order created",
            "orderId": order_id
        }), 201

    except Exception as e:
        db.session.rollback()
        print("Error in create_order:", e)
        return jsonify({"error": "Failed to create order"}), 500


@bp.get("/history")
def get_history():
    status_col = _status_col()
    pk = _pk_col()
    orders = (
        Orders.query
        .filter(db.func.trim(db.func.coalesce(status_col, "")) == "Completed")
        .order_by(pk.desc())
        .all()
    )
    return jsonify([_serialize_order(o) for o in orders])


@bp.patch("/orders/<int:order_id>")
def update_order(order_id: int):
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
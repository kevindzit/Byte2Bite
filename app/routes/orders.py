from flask import Blueprint, jsonify, request
from ..services.order_service import place_order_with_items
from ..extensions import db
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
    return _attr(o, "Items", "items", "ItemList", default="")


def _created_at_attr(o):
    return _attr(o, "CreatedAt", "created_at", "createdAt", "Timestamp", default=None)


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
        db.session.query(Orders, Restaurants.Name)
        .join(Restaurants, Orders.RestaurantID == Restaurants.RestaurantID)
        .filter(Orders.Status.in_(["Pending", "Preparing"]))
        .all()
    )
    orders_list = []
    for order, restaurant_name in active_orders_query:
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
            "totalPrice": str(order.TotalPrice),
            "status": order.Status,
            "items": items_str,
            "items_list": items_list
        })

    return jsonify(orders_list)


@bp.get("/history")
def get_history():
    status_col = _status_col()
    pk = _pk_col()
    orders = Orders.query.filter(
        db.func.trim(db.func.coalesce(status_col, "")) != "Completed"
    ).order_by(pk.desc()).all()
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
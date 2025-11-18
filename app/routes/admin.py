import secrets
from flask import Blueprint, jsonify, request, current_app
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import func
from ..extensions import db
from ..models import (
    Orders,
    OrderItems,
    MenuItems,
    Restaurants,
    Customers,
    InventoryItems,
    StaffUsers,
)

bp = Blueprint("admin", __name__)
_staff_sessions: dict[str, int] = {}


def _serialize_staff(staff: StaffUsers):
    return {
        "id": staff.StaffID,
        "firstName": staff.FirstName,
        "lastName": staff.LastName,
        "email": staff.Email,
        "role": staff.Role,
        "restaurantId": staff.RestaurantID,
    }


def _create_session(staff: StaffUsers):
    token = secrets.token_hex(16)
    _staff_sessions[token] = staff.StaffID
    return token


def _require_admin_session(token: str):
    staff_id = _staff_sessions.get(token or "")
    if not staff_id:
        return None
    staff = StaffUsers.query.get(staff_id)
    if not staff or staff.Role.lower() != "admin":
        return None
    return staff


@bp.get("/orders")
def get_active_orders():

    active_orders_query = (
        db.session.query(
            Orders,
            Restaurants.Name.label("restaurant_name"),
            func.concat(
                func.coalesce(Customers.FirstName, ""),
                " ",
                func.coalesce(Customers.LastName, ""),
            ).label("customer_name"),
        )
        .join(Restaurants, Orders.RestaurantID == Restaurants.RestaurantID)
        .outerjoin(Customers, Orders.CustomerID == Customers.CustomerID)
        .filter(Orders.Status.in_(["Pending", "Preparing"]))
        .all()
    )

    orders_list = []
    for order, restaurant_name, customer_name in active_orders_query:
        # Fetch items for this order
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

        display_name = (customer_name or "").strip()
        if not display_name:
            display_name = "Guest"

        orders_list.append(
            {
                "id": order.OrderID,
                "orderId": order.OrderID,
                "restaurantName": restaurant_name,
                "customer_name": display_name,
                "totalPrice": str(order.TotalPrice),
                "status": order.Status,
                "items": items_str,
                "items_list": items_list,
            }
        )

    return jsonify(orders_list)


@bp.get("/admin/inventory/<int:restaurant_id>")
def get_inventory_for_branch(restaurant_id: int):
    """
    Return all inventory items for a given restaurant.
    """
    items = (
        InventoryItems.query.filter_by(RestaurantID=restaurant_id)
        .order_by(InventoryItems.Name)
        .all()
    )

    return jsonify(
        [
            {
                "id": i.InventoryItemID,
                "name": i.Name,
                "quantity": i.QuantityInStock,
                "unit": i.Unit,
            }
            for i in items
        ]
    )


@bp.post("/admin/inventory/bulk-update")
def bulk_update_inventory():
    data = request.get_json(silent=True) or {}

    restaurant_id = data.get("restaurantId")
    updates = data.get("updates", [])

    if not restaurant_id:
        return jsonify({"error": "restaurantId is required"}), 400
    if not isinstance(updates, list) or not updates:
        return jsonify({"error": "updates must be a non-empty list"}), 400

    results = []

    for upd in updates:
        item_id = upd.get("inventoryItemId")
        delta = upd.get("delta")

        try:
            delta = int(delta)
        except (TypeError, ValueError):
            # Skip invalid row
            continue

        if not item_id:
            continue

        item = (
            InventoryItems.query.filter_by(
                InventoryItemID=item_id, RestaurantID=restaurant_id
            )
            .first()
        )
        if not item:
            continue

        item.QuantityInStock = (item.QuantityInStock or 0) + delta

        results.append(
            {
                "id": item.InventoryItemID,
                "name": item.Name,
                "quantity": item.QuantityInStock,
                "unit": item.Unit,
                "delta": delta,
            }
        )

    db.session.commit()

    return jsonify(
        {
            "message": f"Applied {len(results)} inventory updates",
            "updated": results,
        }
    )


@bp.post("/admin/inventory/order")
def order_inventory():
    data = request.get_json(silent=True) or {}

    restaurant_id = data.get("restaurantId")
    name = (data.get("name") or "").strip()
    unit = (data.get("unit") or "units").strip()
    qty = data.get("quantity")

    if not restaurant_id:
        return jsonify({"error": "restaurantId is required"}), 400
    if not name:
        return jsonify({"error": "name is required"}), 400

    try:
        qty = int(qty)
    except (TypeError, ValueError):
        return jsonify({"error": "quantity must be an integer"}), 400

    item = (
        InventoryItems.query.filter_by(RestaurantID=restaurant_id, Name=name)
        .first()
    )

    if item:
        item.QuantityInStock = (item.QuantityInStock or 0) + qty
        db.session.commit()
        status_code = 200
        message = "Inventory updated"
    else:
        item = InventoryItems(
            RestaurantID=restaurant_id,
            Name=name,
            QuantityInStock=qty,
            Unit=unit,
        )
        db.session.add(item)
        db.session.commit()
        status_code = 201
        message = "New inventory item created"

    return (
        jsonify(
            {
                "id": item.InventoryItemID,
                "name": item.Name,
                "quantity": item.QuantityInStock,
                "unit": item.Unit,
                "message": message,
            }
        ),
        status_code,
    )


@bp.get("/admin/top-menu-items/<int:restaurant_id>")
def get_top_menu_items(restaurant_id: int):
    rows = (
        db.session.query(
            MenuItems.MenuItemID.label("id"),
            MenuItems.Name.label("name"),
            func.sum(OrderItems.Quantity).label("total_quantity"),
            func.sum(
                OrderItems.Quantity * OrderItems.PricePerItem
            ).label("total_revenue"),
        )
        .join(OrderItems, OrderItems.MenuItemID == MenuItems.MenuItemID)
        .join(Orders, Orders.OrderID == OrderItems.OrderID)
        .filter(Orders.RestaurantID == restaurant_id)
        .group_by(MenuItems.MenuItemID, MenuItems.Name)
        .order_by(func.sum(OrderItems.Quantity).desc())
        .limit(10)
        .all()
    )

    return jsonify(
        [
            {
                "id": r.id,
                "name": r.name,
                "total_quantity": int(r.total_quantity or 0),
                "total_revenue": float(r.total_revenue or 0.0),
            }
            for r in rows
        ]
    )


@bp.patch("/admin/menu-items/<int:item_id>")
def update_menu_item(item_id: int):
    item = MenuItems.query.get_or_404(item_id)
    data = request.get_json(silent=True) or {}

    field_map = {
        "name": "Name",
        "description": "Description",
        "price": "Price",
        "category": "Category",
        "available": "IsAvailable",
    }

    for json_key, attr in field_map.items():
        if json_key in data:
            value = data[json_key]
            if attr == "Price" and value is not None:
                value = float(value)
            if attr == "IsAvailable" and value is not None:
                value = bool(value)
            setattr(item, attr, value)

    db.session.commit()

    return jsonify(
        {
            "id": item.MenuItemID,
            "name": item.Name,
            "description": item.Description,
            "price": float(item.Price),
            "category": item.Category,
            "available": item.IsAvailable,
            "message": "Menu item updated",
        }
    )


@bp.post("/staff/login")
def staff_login():
    data = request.get_json(force=True)
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")
    if not email or not password:
        return jsonify({"message": "Email and password required"}), 400

    staff = StaffUsers.query.filter(func.lower(StaffUsers.Email) == email).first()
    if not staff or not check_password_hash(staff.PasswordHash, password):
        return jsonify({"message": "Invalid credentials"}), 401

    session_token = _create_session(staff)
    payload = _serialize_staff(staff)
    payload["sessionToken"] = session_token
    payload["message"] = "Login successful"
    return jsonify(payload)


@bp.get("/staff/me")
def staff_me():
    token = request.args.get("sessionToken")
    staff_id = _staff_sessions.get(token or "")
    if not staff_id:
        return jsonify({"message": "Invalid session"}), 401
    staff = StaffUsers.query.get_or_404(staff_id)
    payload = _serialize_staff(staff)
    payload["sessionToken"] = token
    return jsonify(payload)


@bp.get("/staff")
def get_all_staff():
    token = request.args.get("sessionToken")
    if not _require_admin_session(token):
        return jsonify({"message": "Admin session required"}), 403

    staff_query = (
        db.session.query(StaffUsers, Restaurants.Name)
        .outerjoin(Restaurants, StaffUsers.RestaurantID == Restaurants.RestaurantID)
        .order_by(StaffUsers.RestaurantID, StaffUsers.LastName, StaffUsers.FirstName)
        .all()
    )

    staff_list = []
    for staff, restaurant_name in staff_query:
        staff_data = _serialize_staff(staff)
        staff_data["restaurantName"] = restaurant_name or "Unassigned"
        staff_list.append(staff_data)

    return jsonify(staff_list)


@bp.post("/staff")
def create_staff():
    data = request.get_json(force=True)
    first = (data.get("firstName") or "").strip()
    last = (data.get("lastName") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")
    role = (data.get("role") or "staff").lower()
    restaurant_id = data.get("restaurantId")
    session_token = data.get("sessionToken")

    if not _require_admin_session(session_token):
        # allow bootstrap creation if admin key provided
        admin_key = data.get("adminKey")
        if admin_key != current_app.config["ADMIN_ACCESS_KEY"]:
            return jsonify({"message": "Admin session required"}), 403

    if not first or not last or not email or not password:
        return jsonify({"message": "Missing required fields"}), 400

    if role not in {"staff", "admin"}:
        role = "staff"

    if StaffUsers.query.filter(func.lower(StaffUsers.Email) == email).first():
        return jsonify({"message": "Email already exists"}), 400

    new_staff = StaffUsers(
        FirstName=first,
        LastName=last,
        Email=email,
        PasswordHash=generate_password_hash(password),
        Role=role,
        RestaurantID=restaurant_id,
    )
    db.session.add(new_staff)
    db.session.commit()

    payload = _serialize_staff(new_staff)
    payload["message"] = "Staff account created"
    return jsonify(payload), 201

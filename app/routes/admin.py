from flask import Blueprint, jsonify, request
from ..extensions import db
from ..models import Orders, Restaurants, OrderItems, MenuItems


bp = Blueprint("admin", __name__)


@bp.get("/orders/active")
def get_active_orders():
    q = db.session.query(Orders, Restaurants.Name)\
        .join(Restaurants, Orders.RestaurantID == Restaurants.RestaurantID)\
        .filter(Orders.Status.in_(['Pending', 'Preparing', 'Completed']))\
        .all()

    out = []
    for order, rest_name in q:
        items = db.session.query(OrderItems, MenuItems.Name)\
        .join(MenuItems, OrderItems.MenuItemID == MenuItems.MenuItemID)\
        .filter(OrderItems.OrderID == order.OrderID).all()
    out.append({
        "orderId": order.OrderID,
        "restaurantName": rest_name,
        "totalPrice": str(order.TotalPrice),
        "status": order.Status,
        "items": [{"name": name, "quantity": oi.Quantity} for oi, name in items],
        })
    return jsonify(out)


@bp.put("/orders/<int:order_id>/status")
def update_order_status(order_id):
    order = db.session.get(Orders, order_id)
    if not order:
        return jsonify({'message': 'Order not found'}), 404
    new_status = (request.get_json(force=True) or {}).get('status')
    if new_status not in ['Pending', 'Preparing', 'Completed', 'Ready for Pickup']:
        return jsonify({'message': 'Invalid status update'}), 400
    order.Status = new_status
    db.session.commit()
    return jsonify({'message': f'Order {order_id} status updated to {new_status}'})


@bp.patch("/orders/<int:order_id>")
def patch_order_status(order_id):
    order = db.session.get(Orders, order_id)
    if not order:
        return jsonify({'message': 'Order not found'}), 404
    data = request.get_json(force=True)
    order.Status = data.get('status', order.Status)
    db.session.commit()
    return jsonify({'message': 'Order updated'})




@bp.get("/history")
def get_history():
    orders = Orders.query.filter_by(Status='Completed').order_by(Orders.OrderTime.desc()).limit(50).all()
    out = []
    for order in orders:
        items = db.session.query(OrderItems, MenuItems.Name)\
            .join(MenuItems, OrderItems.MenuItemID == MenuItems.MenuItemID)\
            .filter(OrderItems.OrderID == order.OrderID).all()
        items_str = ", ".join([f"{oi.Quantity}x {name}" for oi, name in items])
        out.append({
            'id': order.OrderID,
            'customer_name': '', # kept minimal, matches source behavior in spirit
            'items': items_str,
            'status': order.Status,
            'created_at': order.OrderTime.strftime('%Y-%m-%d %H:%M:%S') if order.OrderTime else ''
        })
    return jsonify(out)
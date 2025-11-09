from flask import Blueprint, jsonify
from ..models import MenuItems


bp = Blueprint("menu", __name__)




@bp.get("/menu/<int:location_id>")
def get_menu(location_id: int):
    items = MenuItems.query.filter_by(RestaurantID=location_id, IsAvailable=True).all()
    results = []
    for item in items:
        results.append({
            "id": item.MenuItemID,
            "name": item.Name,
            "price": float(item.Price),
            "description": item.Description if hasattr(item, "Description") else "",
        })
    return jsonify(results)
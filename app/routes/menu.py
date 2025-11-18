from flask import Blueprint, jsonify, current_app
from ..models import MenuItems


bp = Blueprint("menu", __name__)

@bp.get("/menu/<int:location_id>")
def get_menu(location_id):
    try:
        items = MenuItems.query.filter_by(RestaurantID=location_id).all()

        if not items:
            return jsonify({"error": "No menu items found for this location"}), 404

        return jsonify([{
            "id": i.MenuItemID,
            "name": i.Name,
            "description": i.Description,
            "price": float(i.Price),
            "category": i.Category,
            "available": i.IsAvailable
        } for i in items]), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching menu for {location_id}: {e}")
        return jsonify({"error": "Internal server error"}), 500
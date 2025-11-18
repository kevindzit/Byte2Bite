import json
import os
from flask import Blueprint, jsonify, current_app
from ..models import MenuItems

# Load image mappings (fallback if DB missing images)
IMAGES_PATH = os.path.join(os.path.dirname(__file__), "../../menu_items.json")
JSON_DATA = {}

try:
    with open(IMAGES_PATH, "r") as f:
        JSON_DATA = json.load(f)
except FileNotFoundError:
    JSON_DATA = {}
except json.JSONDecodeError:
    JSON_DATA = {}

IMAGE_DATA = JSON_DATA.get("menu_items", {})
DEFAULT_IMAGE = JSON_DATA.get("default_image", "Food.webp")

bp = Blueprint("menu", __name__)

@bp.get("/menu/<int:location_id>")
def get_menu(location_id):
    try:
        items = MenuItems.query.filter_by(RestaurantID=location_id).all()

        if not items:
            return jsonify({"error": "No menu items found for this location"}), 404

        response = []

        for i in items:
            image_url = getattr(i, "ImageURL", None) or IMAGE_DATA.get(i.Name) or DEFAULT_IMAGE

            response.append({
                "id": i.MenuItemID,
                "name": i.Name,
                "description": i.Description,
                "price": float(i.Price),
                "category": i.Category,
                "available": i.IsAvailable,
                "image": image_url
            })

        return jsonify(response), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching menu for {location_id}: {e}")
        return jsonify({"error": "Internal server error"}), 500

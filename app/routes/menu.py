import json
import os
from datetime import timedelta

from flask import Blueprint, jsonify, current_app
from google.cloud import storage
from sqlalchemy import func

from ..extensions import db
from ..models import MenuItems, InventoryItems
# use InventoryItems + db to fetch stock

#Load menu item images from JSON file#

# Load image mappings (fallback if DB missing images)
IMAGES_PATH = os.path.join(os.path.dirname(__file__), "../../menu_items.json")
JSON_DATA = {}

# Connect to Google Storage for images
storage_client = storage.Client()
BUCKET_NAME = "byte2biteimages"


# url creation for images 
def generate_signed_url_from_url(image_url: str | None):
    if not image_url:
        return None
    try: 
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(image_url)

        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(hours=1),
            method="GET"
        )
        
        return url

    except Exception as error:
        current_app.logger.error(f"Error generating signed URL for {image_url}")

try:
    with open(IMAGES_PATH, "r") as f:
        JSON_DATA = json.load(f)
except FileNotFoundError:
    #If file not found, use empty dict
    JSON_DATA = {}
except json.JSONDecodeError:
    #If JSON invalid, use empty dict
    JSON_DATA = {}

#Extract image data and default image
IMAGE_DATA = JSON_DATA.get("menu_items", {})
DEFAULT_IMAGE = JSON_DATA.get("default_image", None)

bp = Blueprint("menu", __name__)

#Get menu for location#

@bp.get("/menu/<int:location_id>")
def get_menu(location_id):
    """Returns the menu items for a specific restaurant location
    Has contingency for missing images in DB"""

    # Join inventory by restaurant/name to pull stock
    try:
        rows = (
            db.session.query(
                MenuItems,
                InventoryItems.QuantityInStock.label("stock"),
            )
            .outerjoin(
                InventoryItems,
                (InventoryItems.RestaurantID == MenuItems.RestaurantID)
                & (func.lower(InventoryItems.Name) == func.lower(MenuItems.Name)),
            )
            .filter(MenuItems.RestaurantID == location_id)
            .all()
        )

        if not rows:
            return jsonify({"error": "No menu items found for this location"}), 404

        response = []

        #Build response with image search#
        for i, stock in rows:
            db_image_uri = getattr(i, "ImageURI", None) or getattr(i, "ImageURL", None)
            image_url = None

            if db_image_uri:
                # db_image_uri should be something like 'carne-asada-tacos.jpeg'
                image_url = generate_signed_url_from_url(db_image_uri)

            # 2) Fallback: JSON mapping (typically public URL or static name)
            if not image_url and i.Name in IMAGE_DATA:
                json_image_value = IMAGE_DATA[i.Name]

                # If JSON value looks like a URL, use as-is
                if isinstance(json_image_value, str) and json_image_value.startswith("http"):
                    image_url = json_image_value
                else:
                    # Otherwise treat it as a blob name in the same private bucket
                    image_url = generate_signed_url_from_url(json_image_value) or json_image_value

            # 3) Fallback: default image
            if not image_url and DEFAULT_IMAGE:
                if isinstance(DEFAULT_IMAGE, str) and DEFAULT_IMAGE.startswith("http"):
                    # Default is a public URL
                    image_url = DEFAULT_IMAGE
                else:
                    # Default is a blob name in the private bucket
                    image_url = generate_signed_url_from_url(DEFAULT_IMAGE) or DEFAULT_IMAGE
            
            # Mark unavailable when stock is 0; expose availableQuantity 
            available_quantity = int(stock) if stock is not None else None
            is_available = (i.IsAvailable is not False) and (
                available_quantity is None or available_quantity > 0
            )
            
            response.append({
                "id": i.MenuItemID,
                "name": i.Name,
                "description": i.Description,
                "price": float(i.Price),
                "category": i.Category,
                "available": is_available,
                "availableQuantity": available_quantity,
                "image": image_url
            })

        return jsonify(response), 200

    #Logs errors
    except Exception as e:
        current_app.logger.error(f"Error fetching menu for {location_id}: {e}")
        return jsonify({"error": "Internal server error"}), 500

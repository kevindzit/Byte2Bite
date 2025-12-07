from flask import Blueprint, jsonify
from ..models import Restaurants


bp = Blueprint("restaurants", __name__)

#Get all restaurant locations#

@bp.get("/restaurants")
def get_restaurants():
    """Returns all restaurant locations."""

    #Convert model objects into simple JSON-friendly dictionaries
    all_restaurants = Restaurants.query.all()
    return jsonify([
        {"id": r.RestaurantID, "name": r.Name, "address": r.Address}
        for r in all_restaurants
    ])

from flask import Blueprint, jsonify
from ..models import Restaurants


bp = Blueprint("restaurants", __name__)


@bp.get("/restaurants")
def get_restaurants():
    all_restaurants = Restaurants.query.all()
    return jsonify([
        {"id": r.RestaurantID, "name": r.Name, "address": r.Address}
        for r in all_restaurants
    ])

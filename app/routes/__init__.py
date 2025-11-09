from .restaurants import bp as restaurants_bp
from .menu import bp as menu_bp
from .customers import bp as customers_bp
from .orders import bp as orders_bp
from .admin import bp as admin_bp


def register_blueprints(app):
    app.register_blueprint(restaurants_bp, url_prefix="/api")
    app.register_blueprint(menu_bp, url_prefix="/api")
    app.register_blueprint(customers_bp, url_prefix="/api")
    app.register_blueprint(orders_bp, url_prefix="/api")
    app.register_blueprint(admin_bp, url_prefix="/api")
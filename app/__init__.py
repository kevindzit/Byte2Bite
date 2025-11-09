from flask import Flask
from .config import Config
from .extensions import db, cors, init_cloud_sql
from .routes import register_blueprints


def create_app(config_object: type[Config] = Config):
    app = Flask(__name__)
    app.config.from_object(config_object)

    cors.init_app(app, resources={r"/api/*":{"orgins":app.config.get("CORS_ORGINS", [])}})
    init_cloud_sql(app)
    db.init_app(app)

    register_blueprints(app)
    
    @app.get("/")
    def health():
        return "API is running"
    
    return app

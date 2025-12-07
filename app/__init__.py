from flask import Flask
from .config import Config
from .extensions import db, cors, init_cloud_sql
from .routes import register_blueprints

#Create Flask application factory#
#This function sets up the Flask app with configurations, extensions, and routes.

def create_app(config_object: type[Config] = Config):
    #Create Flask app instance
    app = Flask(__name__)

    #Load configuration
    app.config.from_object(config_object)


    #Initialize extensions#
    #Enable CORS for specified origins
    cors.init_app(app, resources={r"/api/*":{"CORS_ORGINS":app.config.get("CORS_ORGINS", [])}})
    
    #Initialize Cloud SQL connection
    init_cloud_sql(app)

    #Initialize SQLAlchemy
    db.init_app(app)

    #Register application routes/blueprints
    #Pulls in all route definitions
    register_blueprints(app)
    
    #Health check route
    @app.get("/")
    def health():
        return "API is running"
    
    return app

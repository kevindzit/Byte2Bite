from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from google.cloud.sql.connector import Connector
import atexit
import pymysql

#Flas extensions initialization#

#SQLAlchemy instance for database interactions
db = SQLAlchemy()

#CORS instance for handling Cross-Origin Resource Sharing
cors = CORS()

#Cloud SQL Connector instance
_connector: Connector | None = None

#Initialize Cloud SQL connection for Flask app#
def init_cloud_sql(app):
    '''Sets up Cloud SQL connection for the Flask app.'''

    global _connector

    #Create Connector if not already created
    if _connector is None:
        _connector = Connector()

    #Function called by SQLAlchemy to get a new connection
    def getconn():
        return _connector.connect(
            app.config["CLOUDSQL_INSTANCE"],
            "pymysql",
            user=app.config["DB_USER"],
            password=app.config["DB_PASS"],
            db=app.config["DB_NAME"],
        )

    engine_opts = dict(app.config.get("SQLALCHEMY_ENGINE_OPTIONS", {}))
    engine_opts["creator"] = getconn

    engine_opts.setdefault("pool_pre_ping", True)
    engine_opts.setdefault("pool_recycle", 1800)
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = engine_opts

#Cleanup Cloud SQL connector on application exit#

@atexit.register
def _close_connector():
    '''Closes the Cloud SQL connector on application exit.'''
    
    try:
        if _connector:
           _connector.close()
    except Exception:
        pass
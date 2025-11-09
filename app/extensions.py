from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from google.cloud.sql.connector import Connector
import atexit
import pymysql


db = SQLAlchemy()
cors = CORS()

_connector: Connector | None = None


def init_cloud_sql(app):

    global _connector
    if _connector is None:
        _connector = Connector()


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


@atexit.register
def _close_connector():
    try:
        if _connector:
           _connector.close()
    except Exception:
        pass
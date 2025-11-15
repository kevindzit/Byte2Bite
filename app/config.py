import os

os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = os.path.join(
    os.path.dirname(__file__),
    'service-account-key.json'
)

class Config:
    SQLALCHEMY_DATABASE_URI = "mysql+pymysql://"
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    CLOUDSQL_INSTANCE = "carbide-ego-476119-a7:us-central1:byte2bite"
    DB_USER = "byte2bite"
    DB_PASS = "Byte2Bite224!"
    DB_NAME = "byte2bite"
    
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 1800,
    }
    
    CORS_ORIGINS = "*"
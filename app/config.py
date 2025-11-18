import os

# Load service account key located in the app directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SERVICE_KEY = os.path.join(BASE_DIR, "service-account-key.json")

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = SERVICE_KEY



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
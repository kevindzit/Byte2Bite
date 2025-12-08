import os

# Load service account key located in the app directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SERVICE_KEY = os.path.join(BASE_DIR, "service-account-key.json")

# Also check backend-api location for backwards compatibility
BACKEND_API_KEY = os.path.abspath(os.path.join(BASE_DIR, os.pardir, "backend-api", "service-account-key.json"))

# Try app directory first, then backend-api
if os.path.exists(SERVICE_KEY):
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = SERVICE_KEY
elif os.path.exists(BACKEND_API_KEY):
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = BACKEND_API_KEY


#Configuration class for Flask application#
#Stores database connection, CORS, admin key, and Stripe keys.
#Loads settings via app.config.from_object(Config)

class Config:
    #SQLAlchemy settings for connecting to Cloud SQL
    SQLALCHEMY_DATABASE_URI = "mysql+pymysql://"

    #Disable SQLAlchemy event system to save resources
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    #Cloud SQL connection parameters
    CLOUDSQL_INSTANCE = "carbide-ego-476119-a7:us-central1:byte2bite"
    DB_USER = "byte2bite"
    DB_PASS = "Byte2Bite224!"
    DB_NAME = "byte2bite"
    
    #Improve connection health with these options
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 1800,
    }
    
    #CORS allowed origins "*"" allows all origins
    CORS_ORIGINS = "*"

    #Admin access override key
    ADMIN_ACCESS_KEY = os.environ.get("BYTE2BITE_ADMIN_KEY", "byte2bite-admin")

    # Stripe test keys (test mode - no real money)
    STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "sk_test_51Sbv8AHaUxvBeEAkJEpqEBN2ATP8cPlAn8U5iuideEFaWVi8hJZABik5Lq6gKIAw25a6jT0KHta8PlT729izsyxc00poSi4r1j")
    STRIPE_PUBLISHABLE_KEY = os.environ.get("STRIPE_PUBLISHABLE_KEY", "pk_test_51Sbv8AHaUxvBeEAk3SzfZlJNB8uP5iB1HBBDJj2a3L0bdn5hNj29jEZS6IsZOh2CWicb91FZ0i5TjCWeOUDtOip000vdyKFUrG")

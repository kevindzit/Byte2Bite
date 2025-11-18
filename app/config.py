import os
from google.cloud import storage


BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
SERVICE_ACCOUNT_PATH = os.path.join(BASE_DIR, "backend-api", "service-account-key.json")

if os.path.exists(SERVICE_ACCOUNT_PATH):
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = SERVICE_ACCOUNT_PATH



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
    ADMIN_ACCESS_KEY = os.environ.get("BYTE2BITE_ADMIN_KEY", "byte2bite-admin")

    # Stripe test keys (test mode - no real money)
    STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "sk_test_51QVMCiP7FE6NYLqh0FwNBOQFQx8xQZ3ViJQ3XaQ0p9vTphN9kfJxMFbxXPRvEGbS6VGCXxYoMxsJT5IZDNGLmVwN00OUhvKI4g")
    STRIPE_PUBLISHABLE_KEY = os.environ.get("STRIPE_PUBLISHABLE_KEY", "pk_test_51QVMCiP7FE6NYLqhcxNXOBKuKCQoLJWE3IA6OvwBfzWRhCJzQXsxwKxO8jXN9XJXvBb3OXsQQxJXTQ9xXNXBOX00XJ5xQZxB")

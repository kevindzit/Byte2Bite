import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from google.cloud.sql.connector import Connector
import pymysql
import sqlalchemy
from sqlalchemy import text

# Set service account path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVICE_ACCOUNT_PATH = os.path.join(BASE_DIR, "backend-api", "service-account-key.json")
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = SERVICE_ACCOUNT_PATH

# Database config
INSTANCE_CONNECTION_NAME = "carbide-ego-476119-a7:us-central1:byte2bite"
DB_USER = "byte2bite"
DB_PASS = "Byte2Bite224!"
DB_NAME = "byte2bite"

def get_connection():
    connector = Connector()

    def getconn():
        return connector.connect(
            INSTANCE_CONNECTION_NAME,
            "pymysql",
            user=DB_USER,
            password=DB_PASS,
            db=DB_NAME
        )

    pool = sqlalchemy.create_engine(
        "mysql+pymysql://",
        creator=getconn,
    )
    return pool

def upgrade_database():
    print("Connecting to Google Cloud SQL using Cloud SQL connector...")

    try:
        engine = get_connection()

        with engine.connect() as conn:
            print("Connected successfully!")

            # Check current columns
            print("\nChecking current Payments table structure...")
            result = conn.execute(text("""
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = :db_name
                AND TABLE_NAME = 'Payments'
            """), {"db_name": DB_NAME})

            existing_columns = [row[0] for row in result]
            print("Current columns:", existing_columns)

            # Add TransactionID column
            if 'TransactionID' not in existing_columns:
                print("\nAdding TransactionID column...")
                conn.execute(text("ALTER TABLE Payments ADD COLUMN TransactionID VARCHAR(255)"))
                conn.commit()
                print("TransactionID column added!")
            else:
                print("\nTransactionID column already exists")

            # Add PaymentStatus column
            if 'PaymentStatus' not in existing_columns:
                print("\nAdding PaymentStatus column...")
                conn.execute(text("ALTER TABLE Payments ADD COLUMN PaymentStatus VARCHAR(20) DEFAULT 'pending'"))
                conn.commit()
                print("PaymentStatus column added!")
            else:
                print("\nPaymentStatus column already exists")

            # Check indexes
            print("\nChecking indexes...")
            result = conn.execute(text("""
                SELECT DISTINCT INDEX_NAME
                FROM INFORMATION_SCHEMA.STATISTICS
                WHERE TABLE_SCHEMA = :db_name
                AND TABLE_NAME = 'Payments'
            """), {"db_name": DB_NAME})

            existing_indexes = [row[0] for row in result]

            if 'idx_payments_transaction' not in existing_indexes:
                print("Creating index on TransactionID...")
                conn.execute(text("CREATE INDEX idx_payments_transaction ON Payments(TransactionID)"))
                conn.commit()
                print("Index created!")
            else:
                print("Index idx_payments_transaction already exists")

            if 'idx_payments_order' not in existing_indexes:
                print("Creating index on OrderID...")
                conn.execute(text("CREATE INDEX idx_payments_order ON Payments(OrderID)"))
                conn.commit()
                print("Index created!")
            else:
                print("Index idx_payments_order already exists")

            # Update existing payments
            print("\nUpdating existing payments to 'completed' status...")
            result = conn.execute(text("""
                UPDATE Payments
                SET PaymentStatus = 'completed'
                WHERE PaymentStatus IS NULL
            """))
            conn.commit()
            print(f"Updated {result.rowcount} records")

            # Verify final structure
            print("\nFinal Payments table structure:")
            result = conn.execute(text("""
                SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = :db_name
                AND TABLE_NAME = 'Payments'
                ORDER BY ORDINAL_POSITION
            """), {"db_name": DB_NAME})

            for row in result:
                default = f" (default: {row[2]})" if row[2] else ""
                print(f"  - {row[0]}: {row[1]}{default}")

            print("\nDatabase upgrade completed successfully!")

    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    upgrade_database()
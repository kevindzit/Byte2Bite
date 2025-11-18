import pymysql
from pymysql import Error

# Database connection details
DB_CONFIG = {
    'host': '34.61.65.243',
    'user': 'byte2bite',
    'password': 'Byte2Bite224!',
    'database': 'byte2bite_db',
    'port': 3306
}

def check_and_upgrade_database():
    connection = None
    cursor = None

    try:
        # Connect to database
        print("Connecting to Google Cloud SQL...")
        connection = pymysql.connect(**DB_CONFIG)
        cursor = connection.cursor()
        print("Connected successfully!")

        # Check current Payments table structure
        print("\nChecking current Payments table structure...")
        cursor.execute("""
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'byte2bite_db'
            AND TABLE_NAME = 'Payments'
        """)

        columns = cursor.fetchall()
        existing_columns = [col[0] for col in columns]

        print("Current columns in Payments table:")
        for col in columns:
            print(f"  - {col[0]}: {col[1]}")

        # Check if TransactionID column exists
        if 'TransactionID' not in existing_columns:
            print("\nAdding TransactionID column...")
            cursor.execute("ALTER TABLE Payments ADD COLUMN TransactionID VARCHAR(255)")
            print("TransactionID column added successfully!")
        else:
            print("\nTransactionID column already exists - skipping")

        # Check if PaymentStatus column exists
        if 'PaymentStatus' not in existing_columns:
            print("\nAdding PaymentStatus column...")
            cursor.execute("ALTER TABLE Payments ADD COLUMN PaymentStatus VARCHAR(20) DEFAULT 'pending'")
            print("PaymentStatus column added successfully!")
        else:
            print("\nPaymentStatus column already exists - skipping")

        # Check and create indexes
        print("\nChecking indexes...")
        cursor.execute("""
            SELECT INDEX_NAME
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = 'byte2bite_db'
            AND TABLE_NAME = 'Payments'
        """)

        existing_indexes = [idx[0] for idx in cursor.fetchall()]

        if 'idx_payments_transaction' not in existing_indexes:
            print("Creating index on TransactionID...")
            cursor.execute("CREATE INDEX idx_payments_transaction ON Payments(TransactionID)")
            print("Index created successfully!")
        else:
            print("Index idx_payments_transaction already exists - skipping")

        if 'idx_payments_order' not in existing_indexes:
            print("Creating index on OrderID...")
            cursor.execute("CREATE INDEX idx_payments_order ON Payments(OrderID)")
            print("Index created successfully!")
        else:
            print("Index idx_payments_order already exists - skipping")

        # Update existing payments to completed status
        print("\nUpdating existing payments to completed status...")
        cursor.execute("UPDATE Payments SET PaymentStatus = 'completed' WHERE PaymentStatus IS NULL OR PaymentStatus = 'pending'")
        rows_updated = cursor.rowcount
        print(f"Updated {rows_updated} payment records to 'completed' status")

        # Commit all changes
        connection.commit()

        # Verify the changes
        print("\nVerifying final table structure...")
        cursor.execute("""
            SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'byte2bite_db'
            AND TABLE_NAME = 'Payments'
            ORDER BY ORDINAL_POSITION
        """)

        final_columns = cursor.fetchall()
        print("Final Payments table structure:")
        for col in final_columns:
            default = f" (default: {col[2]})" if col[2] else ""
            print(f"  - {col[0]}: {col[1]}{default}")

        print("\n✓ Database upgrade completed successfully!")

    except Error as e:
        print(f"\n✗ Error: {e}")
        if connection:
            connection.rollback()
            print("Changes rolled back due to error")

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()
            print("\nDatabase connection closed")

if __name__ == "__main__":
    check_and_upgrade_database()
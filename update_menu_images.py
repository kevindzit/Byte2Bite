"""
Simple script to update menu images from JSON file
Edit menu_images.json to change images, then run this script
"""

import os
import json
from google.cloud.sql.connector import Connector
import pymysql

# Set up credentials
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = os.path.join(
    os.path.dirname(__file__),
    'backend-api',
    'service-account-key.json'
)

CONFIG_CANDIDATES = ["menu_items.json", "menu_images.json"]

def getconn():
    connector = Connector()
    conn = connector.connect(
        "carbide-ego-476119-a7:us-central1:byte2bite",
        "pymysql",
        user="byte2bite",
        password=os.environ.get("DB_PASSWORD"),  # set DB_PASSWORD in your environment
        db="byte2bite"
    )
    return conn


def load_image_config():
    base_dir = os.path.dirname(__file__)
    for filename in CONFIG_CANDIDATES:
        path = os.path.join(base_dir, filename)
        if os.path.exists(path):
            with open(path, 'r') as f:
                config = json.load(f)
            print(f"Loaded menu image config from {filename}")
            return config

    raise FileNotFoundError(
        f"Could not find any of the config files: {', '.join(CONFIG_CANDIDATES)}"
    )

def update_images():
    # Load image config
    config = load_image_config()

    menu_items = config['menu_items']
    category_defaults = config['category_defaults']
    default_image = config['default_image']

    print("Connecting to database...")
    conn = getconn()
    cursor = conn.cursor()

    try:
        # Check if ImageURL column exists
        cursor.execute("""
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'MenuItems' AND COLUMN_NAME = 'ImageURL'
        """)

        if not cursor.fetchone():
            print("Adding ImageURL column...")
            cursor.execute("ALTER TABLE MenuItems ADD COLUMN ImageURL VARCHAR(500)")

        # Update specific menu items
        print("\nUpdating menu images...")
        for item_name, image_url in menu_items.items():
            if image_url == "default":
                image_url = default_image

            cursor.execute(
                "UPDATE MenuItems SET ImageURL = %s WHERE Name = %s",
                (image_url, item_name)
            )
            if cursor.rowcount > 0:
                print(f"  Updated: {item_name}")

        # Update by category for any items not in the list
        for category, url in category_defaults.items():
            if category.startswith("_"):  # Skip comment fields
                continue
            cursor.execute(
                "UPDATE MenuItems SET ImageURL = %s WHERE Category = %s AND ImageURL IS NULL",
                (url, category)
            )
            if cursor.rowcount > 0:
                print(f"  Updated {cursor.rowcount} {category} items with category default")

        # Set default for anything still without image
        cursor.execute(
            "UPDATE MenuItems SET ImageURL = %s WHERE ImageURL IS NULL",
            (default_image,)
        )
        if cursor.rowcount > 0:
            print(f"  Updated {cursor.rowcount} items with default image")

        conn.commit()
        print("\n[SUCCESS] All images updated!")

    except Exception as e:
        print(f"\n[ERROR] {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    update_images()

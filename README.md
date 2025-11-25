# Byte2Bite

Online ordering system for restaurants - replacing traditional phone orders with a modern POS and kitchen display solution.

## Project Status

### ✅ Completed
- **Front-of-House System** - Staff POS interface for taking orders
- **Kitchen Display System** - Real-time order display for kitchen staff
- **Backend API** - Complete REST API with all endpoints
- **Database Schema** - Full database structure with sample data
- **Google Cloud SQL Setup** - Service account authentication configured
- Successfully migrated schema and seed data into Cloud SQL instance

### 🔄 In Progress
- **Cloud SQL Connection** - Waiting for Cloud SQL Admin API to be enabled
- **1.0 Release** Preparing for 1.0 deployment (API → Cloud Run, Frontend → Hosting)

---

## Tech Stack

### Backend (API)
- **Language:** Python
- **Framework:** Flask
- **Database:** Google Cloud SQL (MySQL 8.0)
- **Authentication:** Service Account (JSON key)
- **ORM:** SQLAlchemy (through Flask SQLAlchemy connector)

### Frontend (Three Systems)
- **Languages:** HTML, CSS, JavaScript
- **Frameworks:** None (pure vanilla JS)
- **Style:** Modern, responsive, light theme
- **Architecture:** Direct-to-API (no build tools required)
- **Deployment Ready:** Can be hosted on GitHub Pages or Cloud Storage

### Database
- **Platform:** Google Cloud SQL
- **Type:** MySQL 8.0.41
- **Instance:** byte2bite (us-central1)
- **Tables:** Restaurants, MenuItems, Customers, Orders, OrderItems, Payments
- **Scaling:** Supports scaling to 12+ restaurant locations through shared DB model

### Development Tools
- **Code Editor:** Visual Studio Code
- **Version Control:** Git / GitHub
- **Testing:** Flask development server + Live Server

---

## Quick Start

### 1. Clone The Repository
'''git clone https://github.com/kevin36776/Byte2Bite.git
cd Byte2Bite
'''

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Set Up Service Account
- Get `service-account-key.json` from team lead
- Place in `backend-api/` folder
- Confirm it is in .gitignore

### 4. Configure Database Environment
DB_USER=byte2bite
DB_PASSWORD= (Needed from team lead)
DB_NAME=byte2bite
DB_HOST=/cloudsql/carbide-ego-476119-a7:us-central1:byte2bite
INSTANCE_CONNECTION_NAME=carbide-ego-476119-a7:us-central1:byte2bite


### 5. Start Backend
```bash
python backend-api/run.py
```
Backend runs at: http://127.0.0.1:5000

### 6. Open Frontend
- **Front-of-House:** 
    - Open your IDE
    - Right-click `front-of-house-system/index.html` → Open with Live Server

- **Kitchen Display:** Right-click `kitchen-display/index.html` → Open with Live Server

---

## Project Structure

```
Byte-2-Bite-Project/
├── backend-api/           # Flask REST API
│   ├── app.py             # Main API file
|   ├── models.py          #Data formatting and layout
|   ├── routes/            #Gets data from a specific item
│   └── service-account-key.json  # Google Cloud credentials (not in git)
├── front-of-house-system/ # Staff POS interface
│   └── index.html        # Complete POS system
├── kitchen-display/       # Kitchen order display
│   ├── index.html        # Active orders view
│   └── history.html      # Completed orders
├── database/             # Database setup files
│   ├── schema.sql        # Table structures
│   └── seed.sql          # Sample data
└── requirements.txt      # Python dependencies
```

---

## Features

### Front-of-House System
- Browse menu with images and prices
- Add/remove items with quantity controls
- Customer search by phone number
- Staff login required before accessing POS
- Admin dashboard uses the same login and can create new staff accounts
- Guest checkout option
- Cash and card payment processing
- Change calculation
- Shopping cart with item count badge

### Kitchen Display System
- Real-time order updates
- Order status management (Pending → Preparing → Completed)
- Timer display for each order
- Order history view
- Color-coded order cards

### Backend API
- Restaurant and menu management
- Customer search and creation
- Order processing and tracking
- Payment recording
- Order status updates
- Active and historical order queries

---

## Team Notes

- Service account key is NOT in GitHub (in .gitignore for security)
- Each teammate needs the JSON key file to connect to database
- Use Live Server extension in VS Code for frontend testing
- Backend must be running for frontend to load data
- "Development server" warning is normal - safe to ignore for development

---

## Next Steps

1. Enable Cloud SQL Admin API in Google Cloud Console
2. Test full order flow from POS to kitchen display
3. Add menu item images
4. Set up for deployment  

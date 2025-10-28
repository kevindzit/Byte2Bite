# Front of House System - Setup Guide

## Overview
Point of Sale system for restaurant staff to take customer orders. Features a modern, light-themed interface matching the design specifications.

## Quick Setup

1. **Start the backend API:**
   ```bash
   python backend-api/app.py
   ```

2. **Open the POS system:**
   - Open `front-of-house-system/index.html` in your browser
   - No additional setup needed - automatically connects to restaurant location

## How to Use

### Taking an Order:
1. **Order Tab**:
   - View menu items with images, descriptions, and prices
   - Use +/- buttons to adjust quantities (number shows in center)
   - Cart badge in top right shows total items

2. **Account Tab**:
   - Search customer by phone (auto-formats as 1-234-567-8901)
   - Results appear below search box
   - OR use Guest Checkout on the right side

3. **Payment Tab**:
   - Select Cash or Card payment method
   - Use numeric keypad to enter amount
   - Change calculated automatically for cash payments
   - Click Complete to submit order

### Features:
- Light theme with clean, modern design
- Hamburger menu in top left for navigation
- Cart indicator in top right corner
- Auto-loads menu from database (no location selection needed)
- Customer phone search with auto-formatting
- Guest checkout for walk-ins
- Cash and card payment processing
- Change calculation for cash payments
- Order confirmation modal
- Seamless integration with kitchen display system

## Interface Elements

**Header:**
- Hamburger menu (☰) - Access navigation drawer
- Restaurant name banner
- Cart icon - Shows item count, click to jump to payment

**Tabs:**
- Order (pink when active) - Browse menu and add items
- Account (pink when active) - Customer search or guest
- Payment (pink when active) - Complete transaction

## Testing
Use these test phone numbers to find existing customers:
- 1234567890
- 0987654321

Or enter any name for guest checkout.

## Troubleshooting

**Menu not loading?**
- Make sure backend API is running on port 5000
- Check browser console for errors
- Verify database connection in app.py

**Customer search not working?**
- Enter full 10-digit phone number
- Phone auto-formats after 10 digits
- Customer must exist in database
- Click X button to clear search

**Order not submitting?**
- Ensure cart has at least one item
- For cash payments: amount must equal or exceed total
- For card payments: system uses exact total
- Check backend API is running

**Cart icon shows 0 but items are selected?**
- Refresh page and try again
- Check browser console for JavaScript errors

## Files
- `index.html` - Complete POS interface with inline CSS/JS (single file)
- Works seamlessly with `kitchen-display/` system
- Uses backend API at http://127.0.0.1:5000

## Design Notes
- Light/white theme for better visibility
- Pink accent color (#f5c6c6) for active states
- Matches provided design mockups exactly
- No location selector needed (each restaurant has their own system)
- Responsive layout works on tablets and desktop monitors
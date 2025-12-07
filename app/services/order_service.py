from decimal import Decimal
from ..extensions import db
from ..models import Orders, OrderItems, MenuItems, Payments, Customers
from .payment_service import create_payment_intent


#Helper function to compute total price of cart items#

def _compute_total(cart_items):
    '''Compute total price of cart items.'''

    total = Decimal("0.00")

    for it in cart_items:
        menu_item = db.session.get(MenuItems, it['id'])
        if menu_item:
            total += Decimal(menu_item.Price) * it['quantity']
    
    return total

#Create a full order including items, discount and rewards#

def place_order_with_items(data: dict) -> int:
    '''Place an order with items, apply discounts and update rewards points.'''

    location_id = data['locationId']
    cart_items = data['items']
    customer_id = data.get('customerId')
    customer_name = data.get('customerName')
    points_to_redeem = data.get('pointsToRedeem', 0)

    total_price = _compute_total(cart_items)

    #Apply points discount (100 points = $1 off)
    discount = Decimal(points_to_redeem) / Decimal(100)
    final_price = max(total_price - discount, Decimal("0.00"))

    new_order = Orders(
        CustomerID=customer_id,
        CustomerName=customer_name,
        RestaurantID=location_id,
        TotalPrice=final_price,
        Status='Pending'
    )

    db.session.add(new_order)
    db.session.commit() #Commit to get OrderID

    #Add order items
    for it in cart_items:
        menu_item = db.session.get(MenuItems, it['id'])
        if menu_item:
            db.session.add(OrderItems(
                OrderID=new_order.OrderID,
                MenuItemID=it['id'],
                Quantity=it['quantity'],
                PricePerItem=menu_item.Price,
            ))

    db.session.commit()

    #Add payment record
    payment = data.get('payment')
    if payment:
        db.session.add(Payments(
            OrderID=new_order.OrderID,
            Amount=payment['amount'],
            PaymentMethod=payment['method'],
        ))
    db.session.commit()

    # Rewards points: earn 10 points per $1, redeem used points
    if customer_id:
        customer = db.session.get(Customers, customer_id)
        if customer:
            points_earned = int(float(final_price) * 10)
            customer.RewardsPoints = (customer.RewardsPoints or 0) - points_to_redeem + points_earned
            db.session.commit()

    return new_order.OrderID


#Stripe order creation with payment intent#

def create_stripe_order(data: dict):
    '''Create an order and payment intent for Stripe payment processing.'''

    location_id = data['locationId']
    cart_items = data['items']
    customer_id = data.get('customerId')
    customer_name = data.get('customerName')
    points_to_redeem = data.get('pointsToRedeem', 0)
    customer_email = data.get('customerEmail')

    total_price = _compute_total(cart_items)
    discount = Decimal(points_to_redeem) / Decimal(100)
    final_price = max(total_price - discount, Decimal("0.00"))

    # Create order with pending payment status
    new_order = Orders(
        CustomerID=customer_id,
        CustomerName=customer_name,
        RestaurantID=location_id,
        TotalPrice=final_price,
        Status='Pending Payment'
    )

    db.session.add(new_order)
    db.session.commit()

    for it in cart_items:
        menu_item = db.session.get(MenuItems, it['id'])
        if menu_item:
            db.session.add(OrderItems(
                OrderID=new_order.OrderID,
                MenuItemID=it['id'],
                Quantity=it['quantity'],
                PricePerItem=menu_item.Price,
            ))

    db.session.commit()

    # Create payment intent
    payment_result = create_payment_intent(final_price, new_order.OrderID, customer_email)

    if payment_result['success']:
        # Create pending payment record
        db.session.add(Payments(
            OrderID=new_order.OrderID,
            Amount=final_price,
            PaymentMethod='Card',
            TransactionID=payment_result['payment_intent_id'],
            PaymentStatus='pending'
        ))
        db.session.commit()

        #Returned to frontend to complete payment via Stripe
        return {
            'order_id': new_order.OrderID,
            'client_secret': payment_result['client_secret'],
            'payment_intent_id': payment_result['payment_intent_id'],
            'amount': float(final_price),
            'points_to_redeem': points_to_redeem
        }
    
    else:
        db.session.rollback()
        return {'error': payment_result['error']}
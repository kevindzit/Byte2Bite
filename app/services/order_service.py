from decimal import Decimal
from ..extensions import db
from ..models import Orders, OrderItems, MenuItems, Payments


def _compute_total(cart_items):
    total = Decimal("0.00")
    for it in cart_items:
        menu_item = db.session.get(MenuItems, it['id'])
        if menu_item:
            total += Decimal(menu_item.Price) * it['quantity']
    return total


def place_order_with_items(data: dict) -> int:
    location_id = data['locationId']
    cart_items = data['items']
    customer_id = data.get('customerId')

    total_price = _compute_total(cart_items)
    new_order = Orders(CustomerID=customer_id, RestaurantID=location_id,
    TotalPrice=total_price, Status='Pending')
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

    payment = data.get('payment')
    if payment:
        db.session.add(Payments(
            OrderID=new_order.OrderID,
            Amount=payment['amount'],
            PaymentMethod=payment['method'],
        ))
    db.session.commit()
    return new_order.OrderID
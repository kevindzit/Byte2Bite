import stripe
from decimal import Decimal
from ..config import Config

stripe.api_key = Config.STRIPE_SECRET_KEY


def create_payment_intent(amount_decimal, order_id, customer_email=None):
    try:
        amount_cents = int(amount_decimal * 100)

        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency='usd',
            metadata={'order_id': str(order_id)},
            receipt_email=customer_email,
            automatic_payment_methods={'enabled': True}
        )

        return {
            'success': True,
            'client_secret': intent.client_secret,
            'payment_intent_id': intent.id
        }
    except stripe.error.StripeError as e:
        return {'success': False, 'error': str(e)}


def verify_payment(payment_intent_id):
    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        return intent.status == 'succeeded'
    except:
        return False
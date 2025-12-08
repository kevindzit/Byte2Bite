import stripe
from decimal import Decimal
from ..config import Config

#Initialize Stripe with secret key
stripe.api_key = Config.STRIPE_SECRET_KEY

#Create payment intent for Stripe#

def create_payment_intent(amount_decimal, order_id, customer_email=None):
    '''Creates a Stripe payment intent for the given amount and order ID.'''

    try: #Convert Decimal to integer cents for Stripe
        amount_cents = int(amount_decimal * 100)

        #Create payment intent
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency='usd',
            metadata={'order_id': str(order_id)}, #Link payment intent to order
            receipt_email=customer_email,       #Sends receipt to customer email
            automatic_payment_methods={'enabled': True}
        )

        return {
            'success': True,
            'client_secret': intent.client_secret,
            'payment_intent_id': intent.id
        }
    except Exception as e:
        #Any Stripe-specific errors
        return {'success': False, 'error': str(e)}

#Verify Stripe payment#

def verify_payment(payment_intent_id):
    '''Verifies the status of a Stripe payment intent by its ID.'''
    
    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        return intent.status == 'succeeded'
    except:
        return False
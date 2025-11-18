-- Add Stripe payment fields to Payments table
ALTER TABLE Payments
ADD COLUMN TransactionID VARCHAR(255),
ADD COLUMN PaymentStatus VARCHAR(20) DEFAULT 'pending';

-- Add index for faster lookups
CREATE INDEX idx_payments_transaction ON Payments(TransactionID);
CREATE INDEX idx_payments_order ON Payments(OrderID);

-- Update existing payments to completed status
UPDATE Payments SET PaymentStatus = 'completed' WHERE PaymentStatus IS NULL;
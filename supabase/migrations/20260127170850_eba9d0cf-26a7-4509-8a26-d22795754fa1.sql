-- Add a column for the "Why?" explanation for late quality events
ALTER TABLE public.daily_operations
ADD COLUMN late_quality_why text DEFAULT '';

-- Add a comment to explain the column
COMMENT ON COLUMN public.daily_operations.late_quality_why IS 'Explanation required when Late H&P, Late Initial Tx Plans, or Late Psych Evals is greater than 0';
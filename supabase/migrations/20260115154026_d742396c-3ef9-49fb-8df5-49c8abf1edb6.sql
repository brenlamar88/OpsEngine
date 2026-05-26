-- Add entry_date column to iop_patients to track which day the patient entry belongs to
ALTER TABLE public.iop_patients ADD COLUMN entry_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Create an index for faster lookups by date
CREATE INDEX idx_iop_patients_entry_date ON public.iop_patients(entry_date);

-- Update existing records to use their created_at date as the entry_date
UPDATE public.iop_patients SET entry_date = DATE(created_at);
-- Add MTP Signed by MD and Internal D/C Surveys fields to daily_operations
ALTER TABLE public.daily_operations
ADD COLUMN mtp_signed_by_md integer NOT NULL DEFAULT 0,
ADD COLUMN internal_dc_surveys_executed integer NOT NULL DEFAULT 0,
ADD COLUMN internal_dc_surveys_why text DEFAULT '';

-- Add comments to explain the columns
COMMENT ON COLUMN public.daily_operations.mtp_signed_by_md IS 'Number of MTPs signed by MD (0-20)';
COMMENT ON COLUMN public.daily_operations.internal_dc_surveys_executed IS 'Number of internal D/C surveys executed (0-20)';
COMMENT ON COLUMN public.daily_operations.internal_dc_surveys_why IS 'Explanation required when internal D/C surveys is less than discharges';
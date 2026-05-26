-- Add comment columns for each module on Daily Operations
ALTER TABLE public.daily_operations
ADD COLUMN IF NOT EXISTS comments_census TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS comments_staffing TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS comments_quality_risk TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS comments_iop TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS comments_employee_risk TEXT DEFAULT '';
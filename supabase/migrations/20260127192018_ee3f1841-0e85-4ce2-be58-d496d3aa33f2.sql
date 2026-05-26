-- Add deficiency reports to dept head field and why explanation
ALTER TABLE public.daily_operations
ADD COLUMN deficiency_reports_to_dept_head boolean DEFAULT true,
ADD COLUMN deficiency_reports_why text DEFAULT '';
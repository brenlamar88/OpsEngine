-- Add comments column for service development section
ALTER TABLE public.daily_operations 
ADD COLUMN comments_service_development text DEFAULT ''::text;
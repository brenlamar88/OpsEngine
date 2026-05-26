-- Add new roles to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'nursing';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'service_development';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'program_administrator';
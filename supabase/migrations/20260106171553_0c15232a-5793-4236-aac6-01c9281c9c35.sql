-- Add new roles to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'adon';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'don';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'him';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sdd';
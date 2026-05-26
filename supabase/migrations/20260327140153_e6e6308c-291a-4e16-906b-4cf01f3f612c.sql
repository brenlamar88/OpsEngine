ALTER TABLE public.units ADD COLUMN operating_days integer[] NOT NULL DEFAULT '{1,2,3,4,5}';

UPDATE public.units SET operating_days = '{2,3,4}' WHERE id = '1bb9cb12-f28b-453c-85c0-ef6bd4267fcd';
-- Add "Professional Fees - Contract Management" row to Billing - Fixed Cost section

-- First, get the section_id for "Billing - Fixed Cost"
WITH billing_section AS (
  SELECT id FROM public.budget_sections WHERE name = 'Billing - Fixed Cost' LIMIT 1
),
-- Get the max display_order in that section
max_order AS (
  SELECT COALESCE(MAX(display_order), 0) as max_order 
  FROM public.budget_rows 
  WHERE section_id = (SELECT id FROM billing_section)
)
INSERT INTO public.budget_rows (
  section_id,
  name,
  row_key,
  data_type,
  entry_mode,
  calculation_type,
  display_order,
  is_active
)
SELECT 
  bs.id,
  'Professional Fees - Contract Management',
  'professional_fees_contract_management',
  'currency',
  'both',
  'manual',
  mo.max_order + 1,
  true
FROM billing_section bs, max_order mo
WHERE bs.id IS NOT NULL;
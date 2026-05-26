-- First, update existing sections to make room for IOP sections at top
-- Shift all non-IOP sections up by 6 positions
UPDATE budget_sections 
SET display_order = display_order + 6 
WHERE name NOT LIKE 'IOP%';

-- Now set IOP sections to display_order 1-6
UPDATE budget_sections SET display_order = 1 WHERE id = '155bac5e-bf1b-4e19-8b8c-4517e9856968'; -- IOP Total Number of Potential Scheduled Patients Per Week Day
UPDATE budget_sections SET display_order = 2 WHERE id = 'e35ec4c5-3903-4e1b-bebe-76baa7a1a858'; -- IOP Utilization
UPDATE budget_sections SET display_order = 3 WHERE id = '799106ae-44dc-42e9-b4f9-2a231fc0d23e'; -- IOP Utilization Percentages
UPDATE budget_sections SET display_order = 4 WHERE id = '9c3d7b27-ccf3-4ce4-811f-022980c81cc5'; -- IOP Patient Days
UPDATE budget_sections SET display_order = 5 WHERE id = '67f0fcec-e452-4011-9ab1-35e16af85cbe'; -- IOP Revenue by PPD
UPDATE budget_sections SET display_order = 6 WHERE id = '389acda3-5fc4-4150-8a3b-2e234330b687'; -- IOP Gross Revenue
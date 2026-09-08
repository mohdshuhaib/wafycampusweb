-- ==============================================================================
-- RLS Policy Updates: Allow Cleaning Leaders to Assign Students & Set Attendance
-- Run this script in the Supabase SQL Editor.
-- ==============================================================================

-- 1. Policies for student_cleaning_assignments
DROP POLICY IF EXISTS "Class leaders can insert" ON public.student_cleaning_assignments;
DROP POLICY IF EXISTS "Class leaders can update" ON public.student_cleaning_assignments;
DROP POLICY IF EXISTS "Cleaning leaders can update is_cleaned" ON public.student_cleaning_assignments;
DROP POLICY IF EXISTS "Cleaning leaders and class leaders can insert" ON public.student_cleaning_assignments;
DROP POLICY IF EXISTS "Cleaning leaders and class leaders can update" ON public.student_cleaning_assignments;
DROP POLICY IF EXISTS "Cleaning leaders and class leaders can delete" ON public.student_cleaning_assignments;

CREATE POLICY "Cleaning leaders and class leaders can insert" 
ON public.student_cleaning_assignments FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('cleanleader', 'classleader')
  )
);

CREATE POLICY "Cleaning leaders and class leaders can update" 
ON public.student_cleaning_assignments FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('cleanleader', 'classleader')
  )
);

CREATE POLICY "Cleaning leaders and class leaders can delete" 
ON public.student_cleaning_assignments FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('cleanleader', 'classleader')
  )
);

-- 2. Policies for student_statuses
DROP POLICY IF EXISTS "Class leaders can insert" ON public.student_statuses;
DROP POLICY IF EXISTS "Class leaders can update" ON public.student_statuses;
DROP POLICY IF EXISTS "Cleaning leaders and class leaders can insert statuses" ON public.student_statuses;
DROP POLICY IF EXISTS "Cleaning leaders and class leaders can update statuses" ON public.student_statuses;
DROP POLICY IF EXISTS "Cleaning leaders and class leaders can delete statuses" ON public.student_statuses;

CREATE POLICY "Cleaning leaders and class leaders can insert statuses" 
ON public.student_statuses FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('cleanleader', 'classleader')
  )
);

CREATE POLICY "Cleaning leaders and class leaders can update statuses" 
ON public.student_statuses FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('cleanleader', 'classleader')
  )
);

CREATE POLICY "Cleaning leaders and class leaders can delete statuses" 
ON public.student_statuses FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('cleanleader', 'classleader')
  )
);

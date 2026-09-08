-- ==============================================================================
-- Supabase Performance Indexes for Wafy Campus Web
-- Run this script in the Supabase SQL Editor to speed up all database queries.
-- ==============================================================================

-- 1. Student Cleaning Assignments Indexes (High Traffic)
CREATE INDEX IF NOT EXISTS idx_student_cleaning_assignments_date_id 
  ON public.student_cleaning_assignments(date_id);

CREATE INDEX IF NOT EXISTS idx_student_cleaning_assignments_place_id 
  ON public.student_cleaning_assignments(place_id);

CREATE INDEX IF NOT EXISTS idx_student_cleaning_assignments_student_cicno 
  ON public.student_cleaning_assignments(student_cicno);

CREATE INDEX IF NOT EXISTS idx_student_cleaning_assignments_date_place 
  ON public.student_cleaning_assignments(date_id, place_id);

CREATE INDEX IF NOT EXISTS idx_student_cleaning_assignments_cleaned 
  ON public.student_cleaning_assignments(is_cleaned);

-- 2. Class Assignments Indexes
CREATE INDEX IF NOT EXISTS idx_class_assignments_date_id 
  ON public.class_assignments(date_id);

CREATE INDEX IF NOT EXISTS idx_class_assignments_place_id 
  ON public.class_assignments(place_id);

CREATE INDEX IF NOT EXISTS idx_class_assignments_class_name 
  ON public.class_assignments(class_name);

CREATE INDEX IF NOT EXISTS idx_class_assignments_date_class 
  ON public.class_assignments(date_id, class_name);

-- 3. Student Statuses Indexes (Attendance)
CREATE INDEX IF NOT EXISTS idx_student_statuses_date_id 
  ON public.student_statuses(date_id);

CREATE INDEX IF NOT EXISTS idx_student_statuses_student_cicno 
  ON public.student_statuses(student_cicno);

CREATE INDEX IF NOT EXISTS idx_student_statuses_date_student 
  ON public.student_statuses(date_id, student_cicno);

CREATE INDEX IF NOT EXISTS idx_student_statuses_status 
  ON public.student_statuses(status);

-- 4. Students Indexes
CREATE INDEX IF NOT EXISTS idx_students_class 
  ON public.students(class);

CREATE INDEX IF NOT EXISTS idx_students_is_exceptional 
  ON public.students(is_exceptional);

CREATE INDEX IF NOT EXISTS idx_students_name 
  ON public.students(name);

-- 5. Cleaning Dates & Places Indexes
CREATE INDEX IF NOT EXISTS idx_cleaning_dates_date 
  ON public.cleaning_dates(date DESC);

CREATE INDEX IF NOT EXISTS idx_cleaning_places_block 
  ON public.cleaning_places(block);

CREATE INDEX IF NOT EXISTS idx_cleaning_places_name 
  ON public.cleaning_places(name);

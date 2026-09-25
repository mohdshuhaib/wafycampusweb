-- ==============================================================================
-- STEP 1: RUN THIS LINE FIRST AND CLICK "RUN"
-- (PostgreSQL requires new enum values to be committed before they can be used)
-- ==============================================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'eduleader';


-- ==============================================================================
-- STEP 2: AFTER STEP 1 SUCCEEDS, RUN THE REST BELOW:
-- ==============================================================================

-- 1. Update your Academic Leader account to 'eduleader'
UPDATE public.profiles 
SET role = 'eduleader'
WHERE designation ILIKE '%academic%' 
   OR id = '3c1061ef-c754-46e1-98a6-ed3fee82fc95';

-- 2. Create the wafy_calendar table
CREATE TABLE IF NOT EXISTS public.wafy_calendar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  academic_year TEXT NOT NULL DEFAULT '2026-2027',
  semester TEXT NOT NULL CHECK (semester IN ('sem1', 'sem2')),
  month_name TEXT NOT NULL,
  month_index INTEGER NOT NULL,
  day INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('period', 'leave', 'exam', 'wafy-leave')),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(academic_year, semester, month_name, day)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_wafy_calendar_year_sem ON public.wafy_calendar(academic_year, semester);
CREATE INDEX IF NOT EXISTS idx_wafy_calendar_status ON public.wafy_calendar(status);

-- Enable RLS
ALTER TABLE public.wafy_calendar ENABLE ROW LEVEL SECURITY;

-- Policies:
DROP POLICY IF EXISTS "Wafy calendar viewable by everyone" ON public.wafy_calendar;
CREATE POLICY "Wafy calendar viewable by everyone" ON public.wafy_calendar FOR SELECT USING (true);

DROP POLICY IF EXISTS "Eduleader can insert calendar" ON public.wafy_calendar;
CREATE POLICY "Eduleader can insert calendar" ON public.wafy_calendar FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'eduleader' OR profiles.role = 'clgleader'))
);

DROP POLICY IF EXISTS "Eduleader can update calendar" ON public.wafy_calendar;
CREATE POLICY "Eduleader can update calendar" ON public.wafy_calendar FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'eduleader' OR profiles.role = 'clgleader'))
);

DROP POLICY IF EXISTS "Eduleader can delete calendar" ON public.wafy_calendar;
CREATE POLICY "Eduleader can delete calendar" ON public.wafy_calendar FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'eduleader' OR profiles.role = 'clgleader'))
);

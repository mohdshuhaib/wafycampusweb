-- ==============================================================================
-- ATTENDANCE MANAGEMENT SYSTEM SCHEMA (Day & Special Attendance)
-- Run this in Supabase SQL Editor to create tables, indexes, RLS, and realtime
-- ==============================================================================

-- 1. DAY ATTENDANCE SCHEDULES (Customizable start & end time per working date)
CREATE TABLE IF NOT EXISTS public.day_attendance_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  start_time TIME WITHOUT TIME ZONE NOT NULL DEFAULT '07:00:00',
  end_time TIME WITHOUT TIME ZONE NOT NULL DEFAULT '07:05:00',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. DAY ATTENDANCE CLASS UNLOCKS (5-minute extension granted by College Leader)
CREATE TABLE IF NOT EXISTS public.day_attendance_class_unlocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  class TEXT NOT NULL,
  unlocked_until TIMESTAMPTZ NOT NULL,
  unlocked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(date, class)
);

-- 3. DAY ATTENDANCE RECORDS (Per-student daily attendance)
CREATE TABLE IF NOT EXISTS public.day_attendance_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  student_cicno TEXT NOT NULL REFERENCES public.students(cicno) ON DELETE CASCADE,
  student_class TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'leave', 'late', 'medical')) DEFAULT 'present',
  marked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(date, student_cicno)
);

-- 4. SPECIAL ATTENDANCES (Ad-hoc sessions like Masjid, Assembly, etc.)
CREATE TABLE IF NOT EXISTS public.special_attendances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subtitle TEXT,
  date DATE NOT NULL,
  target_classes TEXT[] NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. SPECIAL ATTENDANCE CLASS STATUS (Tracks who saved the class and locks out Class Leader if saved by College Leader)
CREATE TABLE IF NOT EXISTS public.special_attendance_class_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  special_attendance_id UUID NOT NULL REFERENCES public.special_attendances(id) ON DELETE CASCADE,
  class TEXT NOT NULL,
  saved_by_role TEXT NOT NULL CHECK (saved_by_role IN ('clgleader', 'classleader')),
  saved_by_user UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  saved_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(special_attendance_id, class)
);

-- 6. SPECIAL ATTENDANCE RECORDS (Student entries for a special session)
CREATE TABLE IF NOT EXISTS public.special_attendance_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  special_attendance_id UUID NOT NULL REFERENCES public.special_attendances(id) ON DELETE CASCADE,
  student_cicno TEXT NOT NULL REFERENCES public.students(cicno) ON DELETE CASCADE,
  student_class TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'not attend', 'leave', 'medical')) DEFAULT 'present',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(special_attendance_id, student_cicno)
);

-- ==============================================================================
-- PERFORMANCE INDEXES (Optimized for 12 classes logging in simultaneously)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_day_att_schedules_date ON public.day_attendance_schedules(date);

CREATE INDEX IF NOT EXISTS idx_day_att_unlocks_date_class ON public.day_attendance_class_unlocks(date, class);
CREATE INDEX IF NOT EXISTS idx_day_att_unlocks_expires ON public.day_attendance_class_unlocks(unlocked_until);

CREATE INDEX IF NOT EXISTS idx_day_att_records_date ON public.day_attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_day_att_records_date_class ON public.day_attendance_records(date, student_class);
CREATE INDEX IF NOT EXISTS idx_day_att_records_cicno ON public.day_attendance_records(student_cicno);
CREATE INDEX IF NOT EXISTS idx_day_att_records_status ON public.day_attendance_records(status);

CREATE INDEX IF NOT EXISTS idx_special_att_date ON public.special_attendances(date);
CREATE INDEX IF NOT EXISTS idx_special_att_status_id_class ON public.special_attendance_class_status(special_attendance_id, class);

CREATE INDEX IF NOT EXISTS idx_special_att_rec_id ON public.special_attendance_records(special_attendance_id);
CREATE INDEX IF NOT EXISTS idx_special_att_rec_id_class ON public.special_attendance_records(special_attendance_id, student_class);
CREATE INDEX IF NOT EXISTS idx_special_att_rec_cicno ON public.special_attendance_records(student_cicno);

-- ==============================================================================
-- ENABLE SUPABASE REALTIME BROADCASTING
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'day_attendance_schedules'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.day_attendance_schedules;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'day_attendance_class_unlocks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.day_attendance_class_unlocks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'day_attendance_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.day_attendance_records;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'special_attendances'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.special_attendances;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'special_attendance_class_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.special_attendance_class_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'special_attendance_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.special_attendance_records;
  END IF;
END $$;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.day_attendance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_attendance_class_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_attendance_class_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_attendance_records ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
DROP POLICY IF EXISTS "Day schedules viewable by authenticated" ON public.day_attendance_schedules;
CREATE POLICY "Day schedules viewable by authenticated" ON public.day_attendance_schedules FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Day unlocks viewable by authenticated" ON public.day_attendance_class_unlocks;
CREATE POLICY "Day unlocks viewable by authenticated" ON public.day_attendance_class_unlocks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Day records viewable by authenticated" ON public.day_attendance_records;
CREATE POLICY "Day records viewable by authenticated" ON public.day_attendance_records FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Special attendances viewable by authenticated" ON public.special_attendances;
CREATE POLICY "Special attendances viewable by authenticated" ON public.special_attendances FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Special class status viewable by authenticated" ON public.special_attendance_class_status;
CREATE POLICY "Special class status viewable by authenticated" ON public.special_attendance_class_status FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Special records viewable by authenticated" ON public.special_attendance_records;
CREATE POLICY "Special records viewable by authenticated" ON public.special_attendance_records FOR SELECT TO authenticated USING (true);

-- Allow College Leader full management
DROP POLICY IF EXISTS "College leader manage day schedules" ON public.day_attendance_schedules;
CREATE POLICY "College leader manage day schedules" ON public.day_attendance_schedules FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'clgleader')
);

DROP POLICY IF EXISTS "College leader manage day unlocks" ON public.day_attendance_class_unlocks;
CREATE POLICY "College leader manage day unlocks" ON public.day_attendance_class_unlocks FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'clgleader')
);

DROP POLICY IF EXISTS "College leader manage day records" ON public.day_attendance_records;
CREATE POLICY "College leader manage day records" ON public.day_attendance_records FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'clgleader')
);

DROP POLICY IF EXISTS "College leader manage special attendances" ON public.special_attendances;
CREATE POLICY "College leader manage special attendances" ON public.special_attendances FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'clgleader')
);

DROP POLICY IF EXISTS "College leader manage special class status" ON public.special_attendance_class_status;
CREATE POLICY "College leader manage special class status" ON public.special_attendance_class_status FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'clgleader')
);

DROP POLICY IF EXISTS "College leader manage special records" ON public.special_attendance_records;
CREATE POLICY "College leader manage special records" ON public.special_attendance_records FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'clgleader')
);

-- Allow Class Leader to insert/update records for their own class
DROP POLICY IF EXISTS "Class leader insert day records" ON public.day_attendance_records;
CREATE POLICY "Class leader insert day records" ON public.day_attendance_records FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'classleader' AND profiles.designation = student_class)
);

DROP POLICY IF EXISTS "Class leader update day records" ON public.day_attendance_records;
CREATE POLICY "Class leader update day records" ON public.day_attendance_records FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'classleader' AND profiles.designation = student_class)
);

DROP POLICY IF EXISTS "Class leader insert special status" ON public.special_attendance_class_status;
CREATE POLICY "Class leader insert special status" ON public.special_attendance_class_status FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'classleader' AND profiles.designation = class)
);

DROP POLICY IF EXISTS "Class leader update special status" ON public.special_attendance_class_status;
CREATE POLICY "Class leader update special status" ON public.special_attendance_class_status FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'classleader' AND profiles.designation = class)
);

DROP POLICY IF EXISTS "Class leader insert special records" ON public.special_attendance_records;
CREATE POLICY "Class leader insert special records" ON public.special_attendance_records FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'classleader' AND profiles.designation = student_class)
);

DROP POLICY IF EXISTS "Class leader update special records" ON public.special_attendance_records;
CREATE POLICY "Class leader update special records" ON public.special_attendance_records FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'classleader' AND profiles.designation = student_class)
);

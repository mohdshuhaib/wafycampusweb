-- Create enums if needed
CREATE TYPE user_role AS ENUM ('clgleader', 'cleanleader', 'classleader');

-- 1. Profiles Table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role user_role NOT NULL,
  designation TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- Allow users to read their own profile, or maybe everyone can read profiles
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);

-- 2. Students Table
CREATE TABLE public.students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cicno TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  class TEXT NOT NULL,
  batch TEXT,
  number NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students viewable by everyone" ON public.students FOR SELECT USING (true);
CREATE POLICY "Class leaders can insert" ON public.students FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'classleader')
);
CREATE POLICY "Class leaders can update" ON public.students FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'classleader')
);
CREATE POLICY "Class leaders can delete" ON public.students FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'classleader')
);

-- 3. Cleaning Places Table
CREATE TABLE public.cleaning_places (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  block TEXT NOT NULL, -- e.g., 'kitchen block', 'academic block', etc.
  description TEXT,
  count INTEGER DEFAULT 1 NOT NULL,
  images_link TEXT, -- Comma-separated drive links
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.cleaning_places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cleaning places viewable by everyone" ON public.cleaning_places FOR SELECT USING (true);
CREATE POLICY "Cleaning leaders can insert" ON public.cleaning_places FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'cleanleader')
);
CREATE POLICY "Cleaning leaders can update" ON public.cleaning_places FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'cleanleader')
);
CREATE POLICY "Cleaning leaders can delete" ON public.cleaning_places FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'cleanleader')
);

-- 4. Tools Table
CREATE TABLE public.tools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  count INTEGER DEFAULT 0 NOT NULL,
  description TEXT,
  image_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tools viewable by everyone" ON public.tools FOR SELECT USING (true);
CREATE POLICY "Cleaning leaders can insert" ON public.tools FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'cleanleader')
);
CREATE POLICY "Cleaning leaders can update" ON public.tools FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'cleanleader')
);
CREATE POLICY "Cleaning leaders can delete" ON public.tools FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'cleanleader')
);

-- 5. Cleaning Dates Table
CREATE TABLE public.cleaning_dates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.cleaning_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cleaning dates viewable by everyone" ON public.cleaning_dates FOR SELECT USING (true);
CREATE POLICY "Cleaning leaders can insert" ON public.cleaning_dates FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'cleanleader')
);

-- 6. Class Assignments (Cleaning leader assigns places to classes on a date)
CREATE TABLE public.class_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date_id UUID REFERENCES public.cleaning_dates(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL,
  place_id UUID REFERENCES public.cleaning_places(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(date_id, class_name, place_id)
);
ALTER TABLE public.class_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Class assignments viewable by everyone" ON public.class_assignments FOR SELECT USING (true);
CREATE POLICY "Cleaning leaders can insert" ON public.class_assignments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'cleanleader')
);
CREATE POLICY "Cleaning leaders can update" ON public.class_assignments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'cleanleader')
);
CREATE POLICY "Cleaning leaders can delete" ON public.class_assignments FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'cleanleader')
);

-- 7. Student Statuses (Class leaders mark attendance for a date)
CREATE TABLE public.student_statuses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date_id UUID REFERENCES public.cleaning_dates(id) ON DELETE CASCADE,
  student_cicno TEXT REFERENCES public.students(cicno) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('present', 'leave', 'medical')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(date_id, student_cicno)
);
ALTER TABLE public.student_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Student statuses viewable by everyone" ON public.student_statuses FOR SELECT USING (true);
CREATE POLICY "Class leaders can insert" ON public.student_statuses FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'classleader')
);
CREATE POLICY "Class leaders can update" ON public.student_statuses FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'classleader')
);

-- 8. Student Cleaning Assignments (Class leaders assign students to places)
CREATE TABLE public.student_cleaning_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date_id UUID REFERENCES public.cleaning_dates(id) ON DELETE CASCADE,
  place_id UUID REFERENCES public.cleaning_places(id) ON DELETE CASCADE,
  student_cicno TEXT REFERENCES public.students(cicno) ON DELETE CASCADE,
  is_cleaned BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(date_id, place_id, student_cicno)
);
ALTER TABLE public.student_cleaning_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Student cleaning assignments viewable by everyone" ON public.student_cleaning_assignments FOR SELECT USING (true);
CREATE POLICY "Class leaders can insert" ON public.student_cleaning_assignments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'classleader')
);
CREATE POLICY "Class leaders can update" ON public.student_cleaning_assignments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'classleader')
);
CREATE POLICY "Cleaning leaders can update is_cleaned" ON public.student_cleaning_assignments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'cleanleader' OR profiles.role = 'classleader'))
);

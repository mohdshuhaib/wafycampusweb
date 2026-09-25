-- ==============================================================================
-- STEP 1: RUN THIS LINE FIRST AND CLICK "RUN" IN SUPABASE SQL EDITOR
-- (PostgreSQL requires new enum values to be committed before they can be used)
-- ==============================================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'student';


-- ==============================================================================
-- STEP 2: RUN THE COMPLETE SCRIPT BELOW AFTER STEP 1 SUCCEEDS
-- ==============================================================================

-- 1. Ensure pgcrypto extension is available for secure password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Performance Indexes for lightning-fast queries, joins, and sorting
CREATE INDEX IF NOT EXISTS idx_students_cicno ON public.students(cicno);
CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(class);
CREATE INDEX IF NOT EXISTS idx_students_name ON public.students(name);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 3. Enable Realtime broadcasting on students and profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'students'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;

-- 4. Students Table RLS
DROP POLICY IF EXISTS "Eduleaders can insert students" ON public.students;
CREATE POLICY "Eduleaders can insert students" ON public.students FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'eduleader' OR profiles.role = 'clgleader'))
);

DROP POLICY IF EXISTS "Eduleaders can update students" ON public.students;
CREATE POLICY "Eduleaders can update students" ON public.students FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'eduleader' OR profiles.role = 'clgleader'))
);

DROP POLICY IF EXISTS "Eduleaders can delete students" ON public.students;
CREATE POLICY "Eduleaders can delete students" ON public.students FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'eduleader' OR profiles.role = 'clgleader'))
);

-- 5. Profiles Table RLS
DROP POLICY IF EXISTS "Eduleaders can insert profiles" ON public.profiles;
CREATE POLICY "Eduleaders can insert profiles" ON public.profiles FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'eduleader' OR profiles.role = 'clgleader'))
  OR auth.uid() = id
);

DROP POLICY IF EXISTS "Eduleaders can update profiles" ON public.profiles;
CREATE POLICY "Eduleaders can update profiles" ON public.profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'eduleader' OR profiles.role = 'clgleader'))
);

-- 6. ATOMIC SINGLE STUDENT CREATION FUNCTION (Auth + Profile + Student in ONE transaction)
CREATE OR REPLACE FUNCTION public.create_student_full_atomic(
  p_cicno TEXT,
  p_name TEXT,
  p_class TEXT,
  p_batch TEXT DEFAULT NULL,
  p_phone NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_encrypted_pw TEXT;
  v_student_record public.students%ROWTYPE;
BEGIN
  v_email := LOWER(TRIM(p_cicno)) || '@campus.com';
  
  -- Check if user already exists in auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email LIMIT 1;
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    v_encrypted_pw := extensions.crypt(TRIM(p_cicno) || '@77', extensions.gen_salt('bf'));

    -- Insert into auth.users (Pre-confirmed, no rate limits, no verification email needed)
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      v_encrypted_pw,
      timezone('utc'::text, now()),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', UPPER(TRIM(p_name)), 'cicno', TRIM(p_cicno), 'class', TRIM(p_class)),
      timezone('utc'::text, now()),
      timezone('utc'::text, now()),
      '',
      '',
      '',
      ''
    );

    -- Insert into auth.identities (Required by Supabase GoTrue for email/password login)
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      v_user_id::text,
      timezone('utc'::text, now()),
      timezone('utc'::text, now()),
      timezone('utc'::text, now())
    );
  ELSE
    -- If user already exists, update password and metadata
    UPDATE auth.users 
    SET encrypted_password = extensions.crypt(TRIM(p_cicno) || '@77', extensions.gen_salt('bf')),
        raw_user_meta_data = jsonb_build_object('name', UPPER(TRIM(p_name)), 'cicno', TRIM(p_cicno), 'class', TRIM(p_class)),
        updated_at = timezone('utc'::text, now())
    WHERE id = v_user_id;
  END IF;

  -- Insert/Update into profiles
  INSERT INTO public.profiles (id, role, designation, created_at)
  VALUES (v_user_id, 'student'::user_role, UPPER(TRIM(p_name)), timezone('utc'::text, now()))
  ON CONFLICT (id) DO UPDATE 
  SET designation = EXCLUDED.designation, role = 'student'::user_role;

  -- Insert/Update into students
  INSERT INTO public.students (cicno, name, class, batch, number, created_at)
  VALUES (TRIM(p_cicno), UPPER(TRIM(p_name)), TRIM(p_class), p_batch, p_phone, timezone('utc'::text, now()))
  ON CONFLICT (cicno) DO UPDATE 
  SET name = EXCLUDED.name, class = EXCLUDED.class, batch = EXCLUDED.batch, number = EXCLUDED.number
  RETURNING * INTO v_student_record;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'cicno', v_student_record.cicno,
    'name', v_student_record.name,
    'class', v_student_record.class,
    'batch', v_student_record.batch,
    'number', v_student_record.number
  );
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Registration failed for student % (%): %', p_name, p_cicno, SQLERRM;
END;
$$;

-- 7. ATOMIC BATCH STUDENT CREATION FUNCTION (Rolls back entire batch if any student fails)
CREATE OR REPLACE FUNCTION public.register_students_batch_atomic(
  p_students JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_student JSONB;
  v_result JSONB;
  v_results JSONB := '[]'::jsonb;
BEGIN
  -- Loop through each student in the JSON array.
  -- If ANY student fails, PostgreSQL automatically cancels & rolls back the entire batch!
  FOR v_student IN SELECT * FROM jsonb_array_elements(p_students)
  LOOP
    v_result := public.create_student_full_atomic(
      v_student->>'cicno',
      v_student->>'name',
      v_student->>'class',
      v_student->>'batch',
      (v_student->>'number')::numeric
    );
    v_results := v_results || jsonb_build_array(v_result);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'count', jsonb_array_length(v_results),
    'records', v_results
  );
EXCEPTION WHEN OTHERS THEN
  -- Abort entire batch: 0 students, 0 auth accounts, 0 profiles will be created!
  RAISE EXCEPTION 'Bulk upload aborted: %', SQLERRM;
END;
$$;

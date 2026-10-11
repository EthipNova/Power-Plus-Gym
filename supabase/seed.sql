-- PowerPlus Gym: Approved Development Test Data for Aerobics Integration (PP-008)
-- All values are derived strictly from canonical project test datasets in src/constants.ts

DO $$
DECLARE
  v_user_id UUID;
  v_trainer_id UUID;
  v_session_id UUID;
  v_plan_id UUID;
  v_customer_id UUID := '11111111-1111-1111-1111-111111111108';
BEGIN
  -- 0. Trainer User Account (for Bethlehem Tesfaye)
  SELECT id INTO v_user_id FROM public.users WHERE email = 'bethlehem@powerplus.et' LIMIT 1;
  IF v_user_id IS NULL THEN
    INSERT INTO public.users (email, password_hash, role, is_active)
    VALUES ('bethlehem@powerplus.et', 'demo_hash', 'TRAINER', true)
    RETURNING id INTO v_user_id;
  END IF;

  -- 1. Trainer Profile (Bethlehem Tesfaye from constants.ts line 110)
  SELECT id INTO v_trainer_id FROM public.trainer_profiles WHERE first_name = 'Bethlehem' AND last_name = 'Tesfaye' LIMIT 1;
  IF v_trainer_id IS NULL THEN
    INSERT INTO public.trainer_profiles (user_id, first_name, last_name, phone, specialization, is_active)
    VALUES (v_user_id, 'Bethlehem', 'Tesfaye', '0922000222', 'Yoga & Cardio', true)
    RETURNING id INTO v_trainer_id;
  END IF;

  -- 2. Aerobics Session (Beginner Aerobics from constants.ts line 180)
  SELECT id INTO v_session_id FROM public.aerobics_sessions WHERE name = 'Beginner Aerobics' LIMIT 1;
  IF v_session_id IS NULL THEN
    INSERT INTO public.aerobics_sessions (name, day_of_week, start_time, end_time, capacity, status, description, active, days, trainer_id)
    VALUES ('Beginner Aerobics', 1, '18:00', '19:00', 24, 'ACTIVE', 'Scheduled group aerobics sessions and schedule', true, ARRAY['Monday', 'Wednesday', 'Friday'], v_trainer_id)
    RETURNING id INTO v_session_id;
  ELSE
    UPDATE public.aerobics_sessions
    SET days = ARRAY['Monday', 'Wednesday', 'Friday'], trainer_id = v_trainer_id
    WHERE id = v_session_id;
  END IF;

  -- 3. Aerobics Plan (Aerobics & Dance Pack from constants.ts line 25)
  SELECT id INTO v_plan_id FROM public.plans WHERE name = 'Aerobics & Dance Pack' LIMIT 1;
  IF v_plan_id IS NULL THEN
    INSERT INTO public.plans (name, price, duration_days, description, benefits, is_active)
    VALUES ('Aerobics & Dance Pack', 1200, 30, 'Aerobics classes, dance fitness, access to class time slots', 'Aerobics classes, Dance fitness', true)
    RETURNING id INTO v_plan_id;
  END IF;

  -- 4. Link PP-008 customer to session
  UPDATE public.customers
  SET aerobics_group_id = v_session_id
  WHERE id = v_customer_id;

  -- 5. Membership for PP-008 (from constants.ts line 36)
  IF NOT EXISTS (SELECT 1 FROM public.memberships WHERE customer_id = v_customer_id) THEN
    INSERT INTO public.memberships (customer_id, plan_id, start_date, end_date, status, price_at_purchase)
    VALUES (v_customer_id, v_plan_id, CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '15 days', 'ACTIVE', 1200);
  END IF;

  -- 6. Historical Attendance for PP-008 (from constants.ts lines 68, 73)
  IF NOT EXISTS (SELECT 1 FROM public.attendance WHERE customer_id = v_customer_id) THEN
    INSERT INTO public.attendance (customer_id, checked_in_at, check_in_method, notes)
    VALUES 
      (v_customer_id, NOW() - INTERVAL '3 days', 'MANUAL', 'Scheduled class check-in'),
      (v_customer_id, NOW() - INTERVAL '1 day', 'MANUAL', 'Private aerobics session');
  END IF;
END $$;

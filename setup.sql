-- --- SETUP SCRIPT FOR NEW PROJECT (PHƯỜNG BÀN CỜ) ---

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. TABLES DEFINITIONS
-- (Including all columns that were previously added via migrations)

-- BẢNG VOTERS
CREATE TABLE IF NOT EXISTS voters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  dob TEXT,
  gender TEXT,
  ethnic TEXT DEFAULT 'Kinh',
  cccd TEXT, -- Removed UNIQUE constraint as per requirement
  voter_card_number TEXT,
  address TEXT,
  neighborhood_id TEXT,
  unit_id TEXT,
  area_id TEXT,
  group_name TEXT,
  residence_status TEXT DEFAULT 'thuong-tru',
  voting_status TEXT DEFAULT 'chua-bau',
  status TEXT DEFAULT 'hop-le',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- BẢNG CANDIDATES
CREATE TABLE IF NOT EXISTS candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  level TEXT CHECK (level IN ('phuong', 'thanh-pho', 'quoc-hoi')),
  unit_id TEXT,
  neighborhood_id TEXT,
  dob TEXT,
  gender TEXT,
  title TEXT,
  hometown TEXT,
  areas TEXT[],
  avatar_url TEXT,
  percentage FLOAT DEFAULT 0,
  votes INTEGER DEFAULT 0,
  rank INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- BẢNG AREA_STATS
CREATE TABLE IF NOT EXISTS area_stats (
  area_id TEXT PRIMARY KEY,
  total_voters INTEGER DEFAULT 0,
  issued_votes INTEGER DEFAULT 0,
  received_votes INTEGER DEFAULT 0,
  valid_votes INTEGER DEFAULT 0,
  invalid_votes INTEGER DEFAULT 0,
  is_locked BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- BẢNG VOTING_RESULTS
CREATE TABLE IF NOT EXISTS voting_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  area_id TEXT NOT NULL,
  candidate_id UUID NOT NULL,
  votes INTEGER DEFAULT 0,
  is_locked BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_area_candidate UNIQUE (area_id, candidate_id)
);

-- BẢNG PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  role TEXT CHECK (role IN ('super_admin', 'ban_chi_dao', 'to_bau_cu', 'nhap_lieu', 'giam_sat', 'khach', 'admin_phuong')),
  unit_id TEXT,
  area_id TEXT,
  neighborhood_id TEXT,
  phone TEXT,
  email TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'locked', 'pending', 'deleted')),
  permissions JSONB,
  last_active TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- BẢNG SYSTEM_LOGS
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name TEXT,
  action TEXT,
  details TEXT,
  ip_address TEXT,
  status TEXT DEFAULT 'success',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. FUNCTIONS

-- Function: create_system_user
CREATE OR REPLACE FUNCTION create_system_user(
    p_email TEXT,
    p_password TEXT,
    p_username TEXT,
    p_full_name TEXT,
    p_role TEXT,
    p_unit_id TEXT DEFAULT NULL,
    p_area_id TEXT DEFAULT NULL,
    p_neighborhood_id TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_permissions JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_encrypted_pw TEXT;
    v_instance_id UUID;
BEGIN
    SELECT instance_id INTO v_instance_id FROM auth.users LIMIT 1;
    IF v_instance_id IS NULL THEN
        v_instance_id := '00000000-0000-0000-0000-000000000000';
    END IF;

    IF EXISTS (SELECT 1 FROM public.profiles WHERE username = p_username AND status != 'deleted') THEN
        RAISE EXCEPTION 'Tên đăng nhập "%" đã tồn tại', p_username;
    END IF;

    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
        RAISE EXCEPTION 'Email "%" đã được sử dụng', p_email;
    END IF;

    v_user_id := gen_random_uuid();
    v_encrypted_pw := crypt(p_password, gen_salt('bf'));

    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, 
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
        created_at, updated_at, confirmation_token, recovery_token, 
        email_change_token_new, email_change, is_super_admin,
        last_sign_in_at, is_sso_user
    ) VALUES (
        v_instance_id,
        v_user_id,
        'authenticated',
        'authenticated',
        p_email,
        v_encrypted_pw,
        NOW(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', p_full_name, 'role', p_role),
        NOW(),
        NOW(),
        '', '', '', '', false,
        NOW(), false
    );

    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, provider_id
    ) VALUES (
        gen_random_uuid(), v_user_id, jsonb_build_object('sub', v_user_id, 'email', p_email), 'email', NOW(), NOW(), NOW(), p_email
    );

    INSERT INTO public.profiles (
        id, username, email, full_name, role, 
        unit_id, area_id, neighborhood_id, phone, permissions, 
        status, created_at
    ) VALUES (
        v_user_id, p_username, p_email, p_full_name, p_role, 
        p_unit_id, p_area_id, p_neighborhood_id, p_phone, p_permissions, 
        'active', NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        unit_id = EXCLUDED.unit_id,
        area_id = EXCLUDED.area_id,
        neighborhood_id = EXCLUDED.neighborhood_id,
        phone = EXCLUDED.phone,
        permissions = EXCLUDED.permissions,
        status = 'active';

    RETURN v_user_id;
END;
$$;

-- Function: update_system_user
CREATE OR REPLACE FUNCTION update_system_user(
    p_user_id UUID,
    p_full_name TEXT,
    p_role TEXT,
    p_password TEXT DEFAULT NULL,
    p_unit_id TEXT DEFAULT NULL,
    p_area_id TEXT DEFAULT NULL,
    p_neighborhood_id TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_permissions JSONB DEFAULT NULL,
    p_status TEXT DEFAULT 'active'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
    UPDATE public.profiles
    SET 
        full_name = p_full_name,
        role = p_role,
        unit_id = p_unit_id,
        area_id = p_area_id,
        neighborhood_id = p_neighborhood_id,
        phone = p_phone,
        permissions = p_permissions,
        status = p_status
    WHERE id = p_user_id;

    UPDATE auth.users
    SET 
        raw_user_meta_data = jsonb_build_object('full_name', p_full_name, 'role', p_role),
        updated_at = NOW(),
        banned_until = CASE WHEN p_status = 'locked' OR p_status = 'deleted' THEN '2099-12-31 00:00:00'::timestamp ELSE NULL END
    WHERE id = p_user_id;

    IF p_password IS NOT NULL AND p_password <> '' THEN
        UPDATE auth.users
        SET encrypted_password = crypt(p_password, gen_salt('bf'))
        WHERE id = p_user_id;
    END IF;
END;
$$;

-- Function: delete_system_user
CREATE OR REPLACE FUNCTION delete_system_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_role TEXT;
    v_count INTEGER;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;

    IF v_role = 'super_admin' THEN
        SELECT COUNT(*) INTO v_count FROM public.profiles WHERE role = 'super_admin' AND status != 'deleted';
        IF v_count <= 1 THEN
            RAISE EXCEPTION 'Không thể xóa tài khoản Super Admin cuối cùng của hệ thống.';
        END IF;
    END IF;

    UPDATE public.profiles 
    SET status = 'deleted', username = username || '_deleted_' || floor(extract(epoch from now()))
    WHERE id = p_user_id;

    UPDATE auth.users 
    SET banned_until = '2099-12-31 00:00:00'::timestamp, 
        email = email || '_deleted_' || floor(extract(epoch from now()))
    WHERE id = p_user_id;
END;
$$;

-- Function: is_admin
CREATE OR REPLACE FUNCTION is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'ban_chi_dao', 'admin_phuong', 'nhap_lieu')
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. SECURITY (RLS) Configuration

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE area_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE voting_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

-- Reset Policies (Safe for re-run)
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Policies: PROFILES
CREATE POLICY "Admins can manage all profiles" ON profiles FOR ALL USING (is_admin());
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (auth.uid() IS NOT NULL);

-- Policies: VOTERS
CREATE POLICY "Admins can manage all voters" ON voters FOR ALL USING (is_admin());
CREATE POLICY "Scope-based voter access" ON voters FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() 
    AND (profiles.area_id = voters.area_id OR profiles.unit_id = voters.unit_id OR profiles.neighborhood_id = voters.neighborhood_id)
    AND profiles.status = 'active'
  )
);
CREATE POLICY "Scope-based voter update" ON voters FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('nhap_lieu', 'to_bau_cu')
    AND (profiles.area_id = voters.area_id OR profiles.unit_id = voters.unit_id)
    AND profiles.status = 'active'
  )
);
CREATE POLICY "Scope-based voter insert" ON voters FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() 
    AND (profiles.role IN ('super_admin', 'ban_chi_dao', 'admin_phuong', 'nhap_lieu')
    OR (profiles.role = 'to_bau_cu' AND (profiles.area_id = voters.area_id OR profiles.unit_id = voters.unit_id)))
    AND profiles.status = 'active'
  )
);

-- Policies: CANDIDATES
CREATE POLICY "Admins can manage candidates" ON candidates FOR ALL USING (is_admin());
CREATE POLICY "Authenticated users can view candidates" ON candidates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Data entry can update candidates" ON candidates FOR UPDATE USING (
  is_admin() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'to_bau_cu' AND profiles.status = 'active')
);
CREATE POLICY "Data entry can insert candidates" ON candidates FOR INSERT WITH CHECK (
  is_admin() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'to_bau_cu' AND profiles.status = 'active')
);

-- Policies: AREA_STATS
CREATE POLICY "Admins can manage area_stats" ON area_stats FOR ALL USING (is_admin());
CREATE POLICY "Scope-based area_stats access" ON area_stats FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.area_id = area_stats.area_id OR is_admin()) AND profiles.status = 'active')
);
CREATE POLICY "Scope-based area_stats update" ON area_stats FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('nhap_lieu', 'to_bau_cu') AND profiles.area_id = area_stats.area_id AND profiles.status = 'active')
);

-- Policies: VOTING_RESULTS
CREATE POLICY "Admins can manage voting_results" ON voting_results FOR ALL USING (is_admin());
CREATE POLICY "Scope-based voting_results access" ON voting_results FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.area_id = voting_results.area_id OR is_admin()) AND profiles.status = 'active')
);
CREATE POLICY "Scope-based voting_results update" ON voting_results FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('nhap_lieu', 'to_bau_cu') AND profiles.area_id = voting_results.area_id AND profiles.status = 'active')
);

-- Policies: SYSTEM_LOGS
CREATE POLICY "Admins can view all logs" ON system_logs FOR SELECT USING (is_admin());
CREATE POLICY "Users can insert own logs" ON system_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 5. PERMISSIONS & SEARCH PATH
GRANT USAGE ON SCHEMA public TO anon, authenticated, authenticator, service_role, postgres;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, authenticator, service_role, postgres;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, authenticator, service_role, postgres;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, authenticator, service_role, postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, authenticator, service_role, postgres;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, authenticator, service_role, postgres;

GRANT SELECT ON auth.users TO authenticator, service_role;

ALTER ROLE anon SET search_path = public, auth, extensions;
ALTER ROLE authenticated SET search_path = public, auth, extensions;
ALTER ROLE authenticator SET search_path = public, auth, extensions;
ALTER ROLE service_role SET search_path = public, auth, extensions;

NOTIFY pgrst, 'reload config';

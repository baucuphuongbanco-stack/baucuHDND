-- ===================================================================
-- COMPREHENSIVE FIX: Grant Full Admin Access to Data Entry (nhap_lieu)
-- ===================================================================
-- This script will ensure nhap_lieu role has:
-- 1. Global SELECT access to all voters (fixes count issue)
-- 2. Global DELETE access to all voters (enables delete button)
-- 3. Global INSERT access to all voters (already working)
-- 4. Global UPDATE access to all voters
-- ===================================================================

-- Step 1: Update the is_admin() helper function
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

-- Step 2: Verify the function was created
SELECT is_admin();

-- Step 3: Refresh PostgREST schema cache
NOTIFY pgrst, 'reload config';

-- Step 4: Verify current user's role (for debugging)
SELECT id, username, role, status FROM profiles WHERE id = auth.uid();

-- ===================================================================
-- VERIFICATION QUERIES (Run these to confirm everything works)
-- ===================================================================

-- Check total voter count (should return 1614)
SELECT COUNT(*) as total_voters FROM voters;

-- Check if current user can see all voters
SELECT COUNT(*) as visible_voters FROM voters WHERE true;

-- Check current user's permissions
SELECT 
    p.username,
    p.role,
    is_admin() as has_admin_access,
    (SELECT COUNT(*) FROM voters) as total_in_db,
    (SELECT COUNT(*) FROM voters WHERE true) as can_see
FROM profiles p 
WHERE p.id = auth.uid();

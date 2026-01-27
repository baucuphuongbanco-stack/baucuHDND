-- ===================================================================
-- KIỂM TRA VAI TRÒ NGƯỜI DÙNG HIỆN TẠI
-- ===================================================================
-- Chạy các query này để xác định vai trò thực tế của tài khoản đang đăng nhập

-- 1. Kiểm tra thông tin user hiện tại
SELECT 
    id,
    username,
    full_name,
    role,
    status,
    area_id,
    unit_id,
    neighborhood_id
FROM profiles 
WHERE id = auth.uid();

-- 2. Kiểm tra tất cả các vai trò có trong hệ thống
SELECT DISTINCT role, COUNT(*) as count
FROM profiles 
WHERE status = 'active'
GROUP BY role
ORDER BY role;

-- 3. Kiểm tra xem user hiện tại có quyền admin không
SELECT is_admin() as has_admin_access;

-- 4. Kiểm tra số lượng cử tri mà user hiện tại nhìn thấy
SELECT COUNT(*) as visible_voters FROM voters;

-- 5. Tổng số cử tri trong hệ thống (chỉ super_admin mới thấy được)
-- SELECT COUNT(*) as total_voters FROM voters;

-- ===================================================================
-- SAU KHI CHẠY CÁC QUERY TRÊN, HÃY GHI CHÚ KẾT QUẢ:
-- - Username: 
-- - Full Name: 
-- - Role (vai trò thực tế): 
-- - Has Admin Access: 
-- - Visible Voters: 
-- ===================================================================

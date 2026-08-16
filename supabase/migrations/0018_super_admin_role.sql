-- =====================================================================
--  0018_super_admin_role.sql
--  Add platform role. Must commit before any CHECK / code uses it.
-- =====================================================================

alter type user_role add value if not exists 'super_admin';

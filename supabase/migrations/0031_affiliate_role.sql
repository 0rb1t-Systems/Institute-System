-- =====================================================================
--  0031_affiliate_role.sql
--  Dedicated Affiliate user role — created via User Management.
--  Registration / settlements accept only role = 'affiliate'.
-- =====================================================================

alter type user_role add value if not exists 'affiliate';

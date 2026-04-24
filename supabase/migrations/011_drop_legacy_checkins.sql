-- 011_drop_legacy_checkins.sql
-- Drop the unused AI check-ins table from the original build. The app no
-- longer references it and the generate-checkin / weekly-insight Edge
-- Functions that populated it have been removed. CASCADE also cleans up
-- its RLS policies and indexes.

drop table if exists public.checkins cascade;

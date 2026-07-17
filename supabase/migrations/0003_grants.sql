-- Same lesson as ReceiptCash: "automatically expose new tables" should be OFF
-- in the Data API settings, so access must be granted explicitly, table by
-- table. RLS policies alone are not sufficient: Postgres checks table-level
-- GRANTs first, and only then applies RLS to filter rows. Without these
-- grants, every operation fails with "permission denied for table X"
-- regardless of how permissive the RLS policies are.
--
-- All v1 tables are owner-scoped with full CRUD from the client, so
-- authenticated gets all four verbs everywhere except profiles (no delete —
-- profile rows die with the auth user via cascade).

grant usage on schema public to anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.properties to authenticated;
grant select, insert, update, delete on public.tenants to authenticated;
grant select, insert, update, delete on public.leases to authenticated;
grant select, insert, update, delete on public.rent_payments to authenticated;
grant select, insert, update, delete on public.documents to authenticated;

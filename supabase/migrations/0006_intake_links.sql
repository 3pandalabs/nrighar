-- Tenant intake links: owner generates /join/<token>, tenant (no login) fills
-- their details and uploads KYC documents, which land as a tenant record +
-- documents for the owner to review. Same anonymous-surface philosophy as pay
-- links: the table is closed to anon; reads go through one narrow
-- security-definer RPC keyed by unguessable uuid, and the write path
-- (multipart upload + row creation) goes through the tenant-intake Edge
-- Function using the service role.

create table public.intake_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'submitted')),
  tenant_id uuid references public.tenants(id) on delete set null,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days'
);

alter table public.intake_links enable row level security;

create policy "intake_links_all_own" on public.intake_links
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create index idx_intake_links_owner on public.intake_links (owner_id);

grant select, insert, update, delete on public.intake_links to authenticated;
grant select, insert, update, delete on public.intake_links to service_role;

-- Anonymous read surface: display data for the join page only.
create function public.get_intake_link(p_token uuid)
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'status', il.status,
    'expired', il.expires_at < now(),
    'owner_name', coalesce(pr.display_name, 'Your landlord'),
    'property_nickname', p.nickname,
    'property_city', p.city
  )
  from public.intake_links il
  left join public.profiles pr on pr.id = il.owner_id
  left join public.properties p on p.id = il.property_id
  where il.id = p_token;
$$;

revoke all on function public.get_intake_link(uuid) from public;
grant execute on function public.get_intake_link(uuid) to anon, authenticated;

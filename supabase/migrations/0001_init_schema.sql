-- NRIGhar initial schema: profiles, properties, tenants, leases, rent_payments, documents.
-- Design principle: everything is owner-scoped. owner_id is denormalized onto every
-- table (including leases and rent_payments) so RLS policies are simple equality
-- checks instead of joins, and every table can be indexed on owner_id.
-- v1 has a single user role (the NRI owner); caretaker/tenant roles come later
-- and will get their own policies rather than loosening these.

-- 1. Profiles (extends auth.users with app-specific fields)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  country_of_residence text,
  preferred_currency text not null default 'USD',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- 2. Properties
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null,
  pincode text not null,
  property_type text not null default 'apartment'
    check (property_type in ('apartment', 'independent_house', 'villa', 'plot', 'commercial')),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.properties enable row level security;

create policy "properties_all_own" on public.properties
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create index idx_properties_owner on public.properties (owner_id);

-- 3. Tenants (records, not users — tenants do not log in, in v1)
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  kyc_status text not null default 'pending'
    check (kyc_status in ('pending', 'submitted', 'verified')),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.tenants enable row level security;

create policy "tenants_all_own" on public.tenants
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create index idx_tenants_owner on public.tenants (owner_id);

-- 4. Leases (tenant x property, with the money terms)
create table public.leases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  rent_amount numeric(12, 2) not null check (rent_amount > 0),
  deposit_amount numeric(12, 2) check (deposit_amount >= 0),
  start_date date not null,
  end_date date,
  rent_due_day integer not null default 1 check (rent_due_day between 1 and 28),
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now()
);

alter table public.leases enable row level security;

create policy "leases_all_own" on public.leases
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create index idx_leases_owner on public.leases (owner_id);
create index idx_leases_property on public.leases (property_id);

-- At most one active lease per property.
create unique index uq_leases_one_active_per_property
  on public.leases (property_id) where (status = 'active');

-- 5. Rent payments (one row per lease per month; upserted when rent is recorded)
create table public.rent_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  lease_id uuid not null references public.leases(id) on delete cascade,
  period_year integer not null check (period_year between 2000 and 2100),
  period_month integer not null check (period_month between 1 and 12),
  amount_due numeric(12, 2) not null check (amount_due >= 0),
  amount_paid numeric(12, 2) check (amount_paid >= 0),
  paid_on date,
  method text check (method in ('bank_transfer', 'upi', 'cash', 'other')),
  status text not null default 'due' check (status in ('due', 'paid', 'partial')),
  notes text,
  created_at timestamptz not null default now(),
  unique (lease_id, period_year, period_month)
);

alter table public.rent_payments enable row level security;

create policy "rent_payments_all_own" on public.rent_payments
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create index idx_rent_payments_owner on public.rent_payments (owner_id);
create index idx_rent_payments_period on public.rent_payments (period_year, period_month);

-- 6. Documents (metadata; files live in the "documents" storage bucket)
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  lease_id uuid references public.leases(id) on delete set null,
  doc_type text not null default 'other'
    check (doc_type in ('agreement', 'kyc', 'property_paper', 'tax', 'other')),
  title text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.documents enable row level security;

create policy "documents_all_own" on public.documents
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create index idx_documents_owner on public.documents (owner_id);

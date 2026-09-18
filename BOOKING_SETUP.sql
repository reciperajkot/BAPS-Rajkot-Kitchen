-- Run this entire file once in Supabase Dashboard -> SQL Editor -> New query.
do $$ begin
  create type public.booking_status as enum ('new', 'approved', 'in_production', 'ready', 'dispatched', 'served', 'cancelled');
exception when duplicate_object then null;
end $$;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  service_date date not null,
  customer_name text not null check (char_length(trim(customer_name)) > 0),
  mobile text,
  people_count integer not null check (people_count > 0),
  location text not null check (char_length(trim(location)) > 0),
  service_time time not null,
  menu_details text,
  status public.booking_status not null default 'new',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bookings enable row level security;
grant select, insert on public.bookings to authenticated;

drop policy if exists "admin can read all bookings" on public.bookings;
drop policy if exists "counter can read own bookings" on public.bookings;
drop policy if exists "production and dispatch can read bookings" on public.bookings;
drop policy if exists "counter can create own bookings" on public.bookings;

create policy "admin can read all bookings" on public.bookings
for select to authenticated
using (public.current_user_role() = 'admin'::public.app_role);

create policy "counter can read own bookings" on public.bookings
for select to authenticated
using (created_by = auth.uid());

create policy "production and dispatch can read bookings" on public.bookings
for select to authenticated
using (public.current_user_role() in ('production'::public.app_role, 'dispatch'::public.app_role));

create policy "counter can create own bookings" on public.bookings
for insert to authenticated
with check (
  created_by = auth.uid()
  and public.current_user_role() in ('counter'::public.app_role, 'admin'::public.app_role)
);

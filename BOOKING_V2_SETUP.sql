-- Run once in Supabase SQL Editor. This upgrades the first booking module.

create table if not exists public.booking_places (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  meal_period text not null check (meal_period in ('breakfast', 'lunch', 'dinner')),
  price_per_person numeric(12,2) not null check (price_per_person >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, meal_period)
);

create table if not exists public.booking_custom_fields (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(trim(label)) > 0),
  field_type text not null check (field_type in ('text', 'number', 'date', 'yes_no', 'select')),
  options jsonb not null default '[]'::jsonb,
  is_required boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.bookings add column if not exists place_id uuid references public.booking_places(id);
alter table public.bookings add column if not exists receipt_number text;
alter table public.bookings add column if not exists rasoi_seva_amount numeric(12,2) not null default 0;
alter table public.bookings add column if not exists thakorji_seva_amount numeric(12,2) not null default 0;
alter table public.bookings add column if not exists final_total numeric(12,2) not null default 0;
alter table public.bookings add column if not exists custom_values jsonb not null default '{}'::jsonb;

create table if not exists public.booking_menu_items (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id),
  item_name text not null,
  price_at_booking numeric(12,2) not null,
  primary key (booking_id, menu_item_id)
);

-- One active booking per place, date and selected 15-minute time.
create unique index if not exists bookings_unique_active_place_time
on public.bookings (service_date, place_id, service_time)
where status <> 'cancelled'::public.booking_status and place_id is not null;

alter table public.booking_places enable row level security;
alter table public.menu_items enable row level security;
alter table public.booking_custom_fields enable row level security;
alter table public.booking_menu_items enable row level security;

drop policy if exists "authenticated users can read active places" on public.booking_places;
drop policy if exists "admins manage places" on public.booking_places;
create policy "authenticated users can read active places" on public.booking_places for select to authenticated using (is_active or public.current_user_role() = 'admin'::public.app_role);
create policy "admins manage places" on public.booking_places for all to authenticated using (public.current_user_role() = 'admin'::public.app_role) with check (public.current_user_role() = 'admin'::public.app_role);

drop policy if exists "admins manage menu items" on public.menu_items;
create policy "admins manage menu items" on public.menu_items for all to authenticated using (public.current_user_role() = 'admin'::public.app_role) with check (public.current_user_role() = 'admin'::public.app_role);

drop policy if exists "authenticated users can read custom fields" on public.booking_custom_fields;
drop policy if exists "admins manage custom fields" on public.booking_custom_fields;
create policy "authenticated users can read custom fields" on public.booking_custom_fields for select to authenticated using (is_active or public.current_user_role() = 'admin'::public.app_role);
create policy "admins manage custom fields" on public.booking_custom_fields for all to authenticated using (public.current_user_role() = 'admin'::public.app_role) with check (public.current_user_role() = 'admin'::public.app_role);

drop policy if exists "admins can read booking menu items" on public.booking_menu_items;
create policy "admins can read booking menu items" on public.booking_menu_items for select to authenticated using (public.current_user_role() = 'admin'::public.app_role);

create or replace view public.available_menu_items as
select id, name, meal_period from public.menu_items where is_active = true;
grant select on public.available_menu_items to authenticated;

create or replace function public.create_booking(
  p_service_date date, p_customer_name text, p_mobile text, p_people_count integer,
  p_place_id uuid, p_service_time time, p_receipt_number text,
  p_rasoi_seva_amount numeric, p_thakorji_seva_amount numeric,
  p_menu_item_ids uuid[], p_custom_values jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_booking_id uuid; v_role public.app_role;
begin
  v_role := public.current_user_role();
  if v_role not in ('counter'::public.app_role, 'admin'::public.app_role) then raise exception 'Only Counter or Admin can create bookings'; end if;
  if p_people_count < 1 then raise exception 'People count must be at least 1'; end if;
  if p_rasoi_seva_amount < 0 or p_thakorji_seva_amount < 0 then raise exception 'Seva amounts cannot be negative'; end if;
  insert into public.bookings (service_date, customer_name, mobile, people_count, location, place_id, service_time, receipt_number, rasoi_seva_amount, thakorji_seva_amount, final_total, custom_values, created_by)
  select p_service_date, trim(p_customer_name), nullif(trim(p_mobile), ''), p_people_count, bp.name, p_place_id, p_service_time, nullif(trim(p_receipt_number), ''), p_rasoi_seva_amount, p_thakorji_seva_amount, p_rasoi_seva_amount + p_thakorji_seva_amount, p_custom_values, auth.uid()
  from public.booking_places bp where bp.id = p_place_id and bp.is_active returning id into v_booking_id;
  if v_booking_id is null then raise exception 'Choose an active place'; end if;
  insert into public.booking_menu_items (booking_id, menu_item_id, item_name, price_at_booking)
  select v_booking_id, mi.id, mi.name, mi.price_per_person from public.menu_items mi where mi.id = any(coalesce(p_menu_item_ids, '{}'::uuid[])) and mi.is_active;
  return v_booking_id;
exception when unique_violation then raise exception 'This place is already booked for the selected date and time';
end; $$;

grant execute on function public.create_booking(date, text, text, integer, uuid, time, text, numeric, numeric, uuid[], jsonb) to authenticated;

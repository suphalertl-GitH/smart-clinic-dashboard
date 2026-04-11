-- ============================================================
-- Auth + RLS Migration
-- รันใน Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- CLINIC_USERS — เชื่อม auth.users → clinics
-- ============================================================
create table if not exists public.clinic_users (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  clinic_id  uuid not null references public.clinics(id) on delete cascade,
  role       text not null default 'admin' check (role in ('admin', 'staff', 'viewer')),
  created_at timestamptz not null default now(),
  unique(user_id, clinic_id)
);

-- ============================================================
-- HELPER FUNCTION — ดึง clinic_id ของ user ที่ login อยู่
-- ============================================================
create or replace function public.my_clinic_id()
returns uuid language sql security definer stable as $$
  select clinic_id
  from   public.clinic_users
  where  user_id = auth.uid()
  limit  1;
$$;

-- ============================================================
-- RLS: CLINIC_USERS
-- ============================================================
alter table public.clinic_users enable row level security;

create policy "clinic_users: read own"
  on public.clinic_users for select
  using (user_id = auth.uid());

-- ============================================================
-- RLS: CLINICS
-- ============================================================
alter table public.clinics enable row level security;

create policy "clinics: read own clinic"
  on public.clinics for select
  using (id = public.my_clinic_id());

create policy "clinics: update own clinic"
  on public.clinics for update
  using (id = public.my_clinic_id());

-- ============================================================
-- RLS: PATIENTS
-- ============================================================
alter table public.patients enable row level security;

create policy "patients: all for own clinic"
  on public.patients for all
  using (clinic_id = public.my_clinic_id());

-- ============================================================
-- RLS: VISITS
-- ============================================================
alter table public.visits enable row level security;

create policy "visits: all for own clinic"
  on public.visits for all
  using (clinic_id = public.my_clinic_id());

-- ============================================================
-- RLS: APPOINTMENTS
-- ============================================================
alter table public.appointments enable row level security;

create policy "appointments: all for own clinic"
  on public.appointments for all
  using (clinic_id = public.my_clinic_id());

-- ============================================================
-- RLS: RECEIPTS
-- ============================================================
alter table public.receipts enable row level security;

create policy "receipts: all for own clinic"
  on public.receipts for all
  using (clinic_id = public.my_clinic_id());

-- ============================================================
-- RLS: NOTIFICATIONS
-- ============================================================
alter table public.notifications enable row level security;

create policy "notifications: all for own clinic"
  on public.notifications for all
  using (clinic_id = public.my_clinic_id());

-- ============================================================
-- RLS: SETTINGS
-- ============================================================
alter table public.settings enable row level security;

create policy "settings: all for own clinic"
  on public.settings for all
  using (clinic_id = public.my_clinic_id());

-- ============================================================
-- RLS: PROMOTIONS (ถ้ามีตารางนี้)
-- ============================================================
do $$ begin
  if exists (select 1 from information_schema.tables where table_name = 'promotions') then
    alter table public.promotions enable row level security;
    execute 'create policy "promotions: all for own clinic" on public.promotions for all using (clinic_id = public.my_clinic_id())';
  end if;
end $$;

-- ============================================================
-- RLS: CAMPAIGNS (ถ้ามีตารางนี้)
-- ============================================================
do $$ begin
  if exists (select 1 from information_schema.tables where table_name = 'campaigns') then
    alter table public.campaigns enable row level security;
    execute 'create policy "campaigns: all for own clinic" on public.campaigns for all using (clinic_id = public.my_clinic_id())';
  end if;
end $$;

-- ============================================================
-- RLS: SATISFACTION_SURVEYS (ถ้ามีตารางนี้)
-- ============================================================
do $$ begin
  if exists (select 1 from information_schema.tables where table_name = 'satisfaction_surveys') then
    alter table public.satisfaction_surveys enable row level security;
    execute 'create policy "satisfaction_surveys: all for own clinic" on public.satisfaction_surveys for all using (clinic_id = public.my_clinic_id())';
  end if;
end $$;

-- ============================================================
-- RLS: CHAT_SESSIONS (ถ้ามีตารางนี้)
-- ============================================================
do $$ begin
  if exists (select 1 from information_schema.tables where table_name = 'chat_sessions') then
    alter table public.chat_sessions enable row level security;
    execute 'create policy "chat_sessions: all for own clinic" on public.chat_sessions for all using (clinic_id = public.my_clinic_id())';
  end if;
end $$;

-- ============================================================
-- SEED: เชื่อม admin account กับ พลอยใสคลินิก
-- แก้ YOUR_USER_ID เป็น auth.uid() ที่ได้จาก Supabase Auth > Users
-- ============================================================
-- insert into public.clinic_users (user_id, clinic_id, role)
-- values ('YOUR_USER_ID', 'a0000000-0000-0000-0000-000000000001', 'admin');

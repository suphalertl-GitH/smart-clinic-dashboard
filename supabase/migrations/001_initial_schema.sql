-- ============================================================
-- Ploysai Clinic - Initial Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- CLINICS (Multi-tenant root)
-- ============================================================
create table clinics (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text not null default '',
  address text not null default '',
  line_channel_access_token text,
  line_channel_secret text,
  liff_id text,
  tier text not null default 'starter' check (tier in ('starter', 'professional', 'enterprise')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- SETTINGS (per clinic)
-- ============================================================
create table settings (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  sales_names text[] not null default '{}',
  doctor_names text[] not null default '{}',
  time_slots text[] not null default '{"11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00"}',
  treatment_cycles jsonb not null default '[
    {"treatment": "Botox", "days": 120},
    {"treatment": "Filler", "days": 365},
    {"treatment": "Sculptra", "days": 540},
    {"treatment": "Profhilo", "days": 180},
    {"treatment": "Juvelook", "days": 180}
  ]',
  updated_at timestamptz not null default now(),
  unique(clinic_id)
);

-- ============================================================
-- PATIENTS
-- ============================================================
create table patients (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  hn text not null,
  full_name text not null,
  phone text not null,
  allergies text,
  disease text,
  face_image_url text,
  consent_image_url text,
  source text,
  sales_name text,
  line_user_id text,
  created_at timestamptz not null default now(),
  unique(clinic_id, hn)
);

create index patients_clinic_id_idx on patients(clinic_id);
create index patients_hn_idx on patients(clinic_id, hn);
create index patients_phone_idx on patients(clinic_id, phone);

-- ============================================================
-- VISITS
-- ============================================================
create table visits (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  hn text not null,
  treatment_name text not null,
  price numeric(10,2) not null default 0,
  doctor text,
  sales_name text,
  customer_type text not null default 'returning' check (customer_type in ('new', 'returning')),
  payment_method text not null default 'โอน' check (payment_method in ('โอน', 'เงินสด', 'เครดิต')),
  appt_date date,
  appt_time text,
  appt_treatment text,
  created_at timestamptz not null default now()
);

create index visits_clinic_id_idx on visits(clinic_id);
create index visits_patient_id_idx on visits(patient_id);
create index visits_hn_idx on visits(clinic_id, hn);
create index visits_created_at_idx on visits(clinic_id, created_at desc);

-- ============================================================
-- APPOINTMENTS
-- ============================================================
create table appointments (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid references patients(id) on delete set null,
  hn text,
  name text not null,
  phone text not null,
  sales_name text,
  doctor text,
  status text not null default 'new' check (status in ('new', 'returning')),
  date date not null,
  time text not null,
  procedure text,
  note text,
  line_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointments_clinic_id_idx on appointments(clinic_id);
create index appointments_date_idx on appointments(clinic_id, date);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger appointments_updated_at
  before update on appointments
  for each row execute function update_updated_at();

-- ============================================================
-- RECEIPTS
-- ============================================================
create table receipts (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  visit_id uuid references visits(id) on delete set null,
  hn text not null,
  full_name text not null,
  items jsonb not null default '[]',
  total numeric(10,2) not null default 0,
  payment_method text not null,
  receiver text not null,
  pdf_url text,
  date date not null,
  created_at timestamptz not null default now()
);

create index receipts_clinic_id_idx on receipts(clinic_id);
create index receipts_hn_idx on receipts(clinic_id, hn);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete set null,
  patient_id uuid references patients(id) on delete set null,
  type text not null check (type in ('reminder', 'confirm', 'followup', 'marketing')),
  line_user_id text not null,
  message text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_status_idx on notifications(status, scheduled_at);
create index notifications_clinic_id_idx on notifications(clinic_id);

-- ============================================================
-- SEED: Default clinic (Ploysai)
-- ============================================================
insert into clinics (id, name, phone, address, tier)
values (
  'a0000000-0000-0000-0000-000000000001',
  'พลอยใสคลินิก',
  '065-553-9361',
  '76/14 โครงการแพลทินัมเพลส ซ.รามคำแหง 178 เขตมีนบุรี กทม. 10510',
  'starter'
);

insert into settings (clinic_id, sales_names, doctor_names)
values (
  'a0000000-0000-0000-0000-000000000001',
  '{"ไลลา", "ไอซ์"}',
  '{"หมอพลอยใส", "หมอมินนี่", "หมอปอย"}'
);

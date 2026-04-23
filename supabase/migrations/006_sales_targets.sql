-- ============================================================
-- Sales Targets — per-clinic, per-salesperson monthly target
-- ============================================================

create table sales_targets (
  id         uuid primary key default uuid_generate_v4(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  sales_name text not null,
  target     numeric(12,2) not null default 0 check (target >= 0),
  updated_at timestamptz not null default now(),
  unique(clinic_id, sales_name)
);

create index sales_targets_clinic_id_idx on sales_targets(clinic_id);

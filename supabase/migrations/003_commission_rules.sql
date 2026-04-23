-- ============================================================
-- Commission Rules (Phase 1 — additive only)
-- ============================================================

create table commission_rules (
  id         uuid primary key default uuid_generate_v4(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  sales_name text not null,
  rate       numeric(5,2) not null default 0 check (rate >= 0 and rate <= 100),
  created_at timestamptz not null default now(),
  unique(clinic_id, sales_name)
);

create index commission_rules_clinic_id_idx on commission_rules(clinic_id);

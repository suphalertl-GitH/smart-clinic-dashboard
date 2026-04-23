-- ============================================================
-- Treatment Courses & Sessions (Phase 1 — additive only)
-- ============================================================

create table treatment_courses (
  id                 uuid primary key default uuid_generate_v4(),
  clinic_id          uuid not null references clinics(id) on delete cascade,
  patient_id         uuid references patients(id) on delete set null,
  hn                 text not null,
  patient_name       text not null,
  treatment_name     text not null,
  total_sessions     int not null default 1 check (total_sessions >= 1),
  completed_sessions int not null default 0,
  price              numeric(10,2) not null default 0,
  status             text not null default 'active'
                       check (status in ('active', 'completed', 'expired')),
  notes              text,
  started_at         date not null default current_date,
  expires_at         date,
  created_at         timestamptz not null default now()
);

create index treatment_courses_clinic_id_idx on treatment_courses(clinic_id);
create index treatment_courses_status_idx    on treatment_courses(clinic_id, status);
create index treatment_courses_hn_idx        on treatment_courses(clinic_id, hn);

-- ── session log ───────────────────────────────────────────────
create table course_sessions (
  id          uuid primary key default uuid_generate_v4(),
  course_id   uuid not null references treatment_courses(id) on delete cascade,
  clinic_id   uuid not null references clinics(id) on delete cascade,
  doctor      text,
  notes       text,
  session_date date not null default current_date,
  created_at  timestamptz not null default now()
);

create index course_sessions_course_id_idx on course_sessions(course_id);

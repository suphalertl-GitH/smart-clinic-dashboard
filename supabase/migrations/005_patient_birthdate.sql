-- ============================================================
-- Add birthdate to patients (Phase 1 — additive only)
-- ============================================================
alter table patients add column if not exists birthdate date;

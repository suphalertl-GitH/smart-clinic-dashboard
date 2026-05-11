-- เพิ่ม sync schedule ใน settings table
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS sync_auto_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sync_times        text[]  NOT NULL DEFAULT '{}';

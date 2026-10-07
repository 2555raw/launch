-- What the screenshot itself shows, read automatically after upload, so the
-- admin review can flag uploads whose photo doesn't match the typed steps or day.
alter table step_entries add column if not exists ocr_status text;  -- match | mismatch | unreadable | error
alter table step_entries add column if not exists ocr_steps integer;
alter table step_entries add column if not exists ocr_day date;
alter table step_entries add column if not exists ocr_note text;

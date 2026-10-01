-- Screenshot attached to steps uploaded from the browser, so the team can
-- check them before they count. Stored as a compressed image data URL.
alter table step_entries add column if not exists proof_image text;

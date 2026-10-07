-- The Stepit token contract address, shown on the home page with a copy button.
-- Empty hides it. Set from the admin settings.
alter table platform_settings add column if not exists project_ca text not null default '';

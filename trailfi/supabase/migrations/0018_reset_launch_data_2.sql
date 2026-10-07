-- Second one-off pre-launch reset, approved by the owner (picked option 1) the day before launch:
-- removes every test account (admins included; they are recreated as admin on
-- their next sign-in), step upload with its screenshot, reward, referral,
-- distribution and payout, so the site goes live at zero. Settings (rates,
-- budget), settings history and newsletter emails are kept. Runs once.
truncate table payouts, rewards, distributions, step_entries, users restart identity cascade;
insert into audit_log (actor, action, entity, entity_id, details)
values ('system', 'system.reset_launch_data', null, null, '{"reason": "second pre-launch reset approved by the owner"}');

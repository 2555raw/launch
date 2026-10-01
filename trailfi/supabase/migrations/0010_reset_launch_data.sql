-- One-off pre-launch reset, approved by the owner: removes every test account,
-- step upload, reward, distribution and payout so the site starts at zero.
-- Settings, settings history and newsletter emails are kept. Runs once.
truncate table payouts, rewards, distributions, step_entries, users restart identity cascade;
insert into audit_log (actor, action, entity, entity_id, details)
values ('system', 'system.reset_launch_data', null, null, '{"reason": "pre-launch reset approved by the owner"}');

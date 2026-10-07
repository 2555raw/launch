-- Third one-off reset, asked for by the owner ahead of a rebrand ("borra los
-- walkers de ahora"): removes every account (admins included; they are
-- recreated as admin on their next sign-in) with its step uploads, rewards,
-- referrals, distributions, payouts and reminder subscriptions. The two USDG
-- transfers already sent stay on Robinhood Chain; only the site's records go.
-- Settings, settings history and newsletter emails are kept. Runs once.
truncate table payouts, rewards, distributions, step_entries, users restart identity cascade;
insert into audit_log (actor, action, entity, entity_id, details)
values ('system', 'system.reset_launch_data', null, null, '{"reason": "reset before the rebrand, asked for by the owner"}');

-- Fingerprints of each uploaded screenshot, so a photo reused on another day
-- or from another wallet is flagged for review.
--   proof_sha    sha256 of the stored image: identical files
--   proof_thumb  48 x 48 greyscale thumbnail: the same picture resized or re-saved
--   proof_match  the earlier upload it matched, if any
alter table step_entries add column if not exists proof_sha text;
alter table step_entries add column if not exists proof_thumb bytea;
alter table step_entries add column if not exists proof_match uuid references step_entries(id) on delete set null;
create index if not exists step_entries_proof_sha_idx on step_entries (proof_sha) where proof_sha is not null;

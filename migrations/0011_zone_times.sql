alter table levels add column if not exists support_at timestamptz;
alter table levels add column if not exists resistance_at timestamptz;

update levels
set support_at = updated_at
where support_at is null and brief <> '';

update levels
set resistance_at = updated_at
where resistance_at is null and brief <> '';

alter table levels add column if not exists comment_at timestamptz;

update levels
set comment_at = updated_at
where comment <> '' and comment_at is null;

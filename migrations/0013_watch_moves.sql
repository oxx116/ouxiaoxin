create table if not exists watch_seen (
  ticker text primary key,
  board text not null default ''
);

create table if not exists watch_moves (
  id bigserial primary key,
  ticker text not null,
  name text not null default '',
  action text not null,
  board text not null,
  moved_at timestamptz not null default now()
);

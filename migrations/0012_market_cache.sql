alter table levels add column if not exists last_open text not null default '';

create table if not exists candle_cache (
  ticker text primary key,
  bars jsonb not null,
  updated_at timestamptz not null default now()
);

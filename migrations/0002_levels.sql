create table if not exists admins (
  user_id text primary key,
  created_at timestamptz not null default now()
);

create table if not exists levels (
  id serial primary key,
  name text not null,
  ticker text not null default '',
  support text not null default '',
  resistance text not null default '',
  right_side text not null default '',
  breakout_close text not null default '',
  updated_at timestamptz not null default now()
);

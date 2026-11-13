create table if not exists user_access (
  user_id text primary key references "user" ("id") on delete cascade,
  disabled boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table levels add column if not exists value_2026 text not null default '';
alter table levels add column if not exists value_2027 text not null default '';

update levels
set value_2026 = '258-476', value_2027 = '333-614'
where ticker = 'TSM' and value_2026 = '';

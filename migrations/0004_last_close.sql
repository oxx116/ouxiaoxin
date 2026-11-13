alter table levels add column if not exists last_close text not null default '';

update levels set last_close = '375.44' where ticker = 'TSM' and last_close = '';

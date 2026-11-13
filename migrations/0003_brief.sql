alter table levels add column if not exists brief text not null default '';

insert into levels (name, ticker, brief)
select '', 'TSM', $brief$
TSM
支撑
320-350（强）长线
270-306（强）
258-266（小）
236-247（强）
226-229（小）

压力
360-378（强）长线
383-396（中）
399-406（强）长线
410-424（强）激进
427-446（中）
450-461（小）
466-478（小）
$brief$
where not exists (select 1 from levels where ticker = 'TSM');

-- Run once in the Supabase SQL Editor. Safe to rerun.
begin;
create table if not exists public.fw_profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 24),
 avatar text not null default 'comet' check(avatar in ('comet','nova','moon','bolt','orbit','star')),
 wins int not null default 0, losses int not null default 0, draws int not null default 0
);
create table if not exists public.fw_arsenals(
 owner uuid primary key references auth.users(id) on delete cascade,
 weapons jsonb not null check(jsonb_typeof(weapons)='array' and jsonb_array_length(weapons)<=100 and octet_length(weapons::text)<=200000),
 updated_at timestamptz default now() not null
);
create table if not exists public.fw_rooms(
 code text primary key, host uuid not null references public.fw_profiles(id) on delete cascade,
 guest uuid references public.fw_profiles(id) on delete cascade, setup jsonb not null,
 state jsonb, version int not null default 0, ended boolean not null default false,
 last_ids jsonb not null default '{}', created_at timestamptz not null default now(),check(guest is null or guest<>host)
);
alter table public.fw_profiles enable row level security;
alter table public.fw_arsenals enable row level security;
alter table public.fw_rooms enable row level security;
revoke all on public.fw_profiles, public.fw_arsenals, public.fw_rooms from public, anon, authenticated;
grant all on public.fw_profiles,public.fw_rooms,public.fw_arsenals to service_role;
grant select on public.fw_profiles to authenticated;
grant insert(id,name,avatar),update(name,avatar) on public.fw_profiles to authenticated;
grant select,insert,update,delete on public.fw_arsenals to authenticated;
drop policy if exists fw_read_profiles on public.fw_profiles;
create policy fw_read_profiles on public.fw_profiles for select to authenticated using(true);
drop policy if exists fw_insert_profile on public.fw_profiles;
create policy fw_insert_profile on public.fw_profiles for insert to authenticated with check(id=(select auth.uid()));
drop policy if exists fw_edit_profile on public.fw_profiles;
create policy fw_edit_profile on public.fw_profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
drop policy if exists fw_private_arsenal on public.fw_arsenals;
create policy fw_private_arsenal on public.fw_arsenals for all to authenticated using(owner=(select auth.uid())) with check(owner=(select auth.uid()));
create or replace function public.fw_record_result() returns trigger language plpgsql set search_path='' as $$
declare winner int := (new.state->>'winner')::int;
begin
 if new.ended and not old.ended and new.guest is not null then
  update public.fw_profiles set
   wins=wins+case when (id=new.host and winner=0) or (id=new.guest and winner=1) then 1 else 0 end,
   losses=losses+case when (id=new.host and winner=1) or (id=new.guest and winner=0) then 1 else 0 end,
   draws=draws+case when winner is null then 1 else 0 end
  where id in(new.host,new.guest);
 end if;
 return new;
end $$;
revoke all on function public.fw_record_result() from public,anon,authenticated;
drop trigger if exists fw_finish on public.fw_rooms;
create trigger fw_finish after update on public.fw_rooms for each row execute function public.fw_record_result();
create or replace view public.fw_ladder with(security_invoker=true) as
select id,name,avatar,wins,losses,draws,3*wins+draws as points,
 dense_rank() over(order by 3*wins+draws desc,wins desc) as rank
from public.fw_profiles where wins+losses+draws>0;
revoke all on public.fw_ladder from public,anon;
grant select on public.fw_ladder to authenticated;
commit;

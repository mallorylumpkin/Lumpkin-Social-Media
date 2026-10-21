-- 009_ai_usage_and_content_settings.sql
-- Phase 3: AI call log (for the daily request cap and cost tracking) and content settings.
-- Safe to run more than once.

create table if not exists public.ai_usage (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  provider    text not null,
  model       text not null,
  purpose     text not null default 'content',
  ok          boolean not null default true,
  tokens_in   integer,
  tokens_out  integer,
  cost_usd    numeric(10,4) not null default 0,
  error       text,
  created_by  uuid references public.users (id),
  created_at  timestamptz not null default now()
);

create index if not exists ai_usage_org_time_idx on public.ai_usage (org_id, created_at desc);

alter table public.ai_usage enable row level security;

drop policy if exists ai_usage_select on public.ai_usage;
create policy ai_usage_select on public.ai_usage for select to authenticated
  using (app.is_member(org_id));

drop policy if exists ai_usage_insert on public.ai_usage;
create policy ai_usage_insert on public.ai_usage for insert to authenticated
  with check (app.has_role(org_id, array['owner','admin','editor']));

-- New content settings for every existing workspace (new workspaces get them below).
create or replace function public.seed_content_settings(p_org uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.settings (org_id, key, value, is_default, description) values
    (p_org, 'ai.provider',            '"gemini"',            true, 'DEFAULT: free Gemini API. Set to "none" to use only no-AI drafts.'),
    (p_org, 'ai.model',               '"gemini-2.5-flash"',  true, 'DEFAULT: change this if Google retires the model name (the app shows an error naming it).'),
    (p_org, 'ai.daily_request_cap',   '40',                  true, 'DEFAULT: most AI calls per day. Keeps you inside the free limits.'),
    (p_org, 'content.default_angle',  '"problem_solution"',  true, 'DEFAULT: starting angle for new packages.')
  on conflict (org_id, key) do nothing;
$$;

revoke all on function public.seed_content_settings(uuid) from public;
grant execute on function public.seed_content_settings(uuid) to authenticated;

select public.seed_content_settings(id) from public.organizations;

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create type public.user_role as enum ('user', 'admin');
create type public.pricing_plan_kind as enum ('recharge', 'subscription');
create type public.pricing_plan_status as enum ('active', 'inactive');
create type public.order_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.payment_provider as enum ('stripe', 'coinbase', 'alipay', 'wechat');
create type public.payment_attempt_status as enum ('pending', 'succeeded', 'failed');
create type public.task_status as enum (
  'created',
  'quota_frozen',
  'extracting_files',
  'awaiting_primary_file_confirmation',
  'building_rule_card',
  'outline_ready',
  'awaiting_outline_approval',
  'drafting',
  'adjusting_word_count',
  'verifying_references',
  'exporting',
  'deliverable_ready',
  'humanizing',
  'humanized_ready',
  'failed',
  'expired'
);
create type public.task_file_role as enum ('requirement', 'background', 'irrelevant', 'unknown');
create type public.task_output_kind as enum ('final_docx', 'reference_report_pdf', 'humanized_docx');
create type public.reference_verdict as enum ('matching', 'risky');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  role public.user_role not null default 'user',
  is_frozen boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.quota_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  recharge_quota integer not null default 0 check (recharge_quota >= 0),
  subscription_quota integer not null default 0 check (subscription_quota >= 0),
  frozen_quota integer not null default 0 check (frozen_quota >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.pricing_plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  kind public.pricing_plan_kind not null,
  status public.pricing_plan_status not null default 'active',
  price_minor integer not null check (price_minor >= 0),
  currency text not null,
  quota_amount integer not null check (quota_amount >= 0),
  word_limit integer,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pricing_plan_id uuid references public.pricing_plans(id) on delete set null,
  status public.order_status not null default 'pending',
  payment_provider public.payment_provider not null,
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null,
  purchased_quota integer not null default 0 check (purchased_quota >= 0),
  external_order_id text,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider public.payment_provider not null,
  provider_event_id text,
  status public.payment_attempt_status not null default 'pending',
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.writing_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.task_status not null default 'created',
  title text,
  topic text,
  target_word_count integer not null default 2000 check (target_word_count > 0),
  citation_style text not null default 'APA 7',
  requested_chapter_count integer,
  outline_revision_count integer not null default 0 check (outline_revision_count >= 0),
  special_requirements text not null default '',
  primary_requirement_file_id uuid,
  latest_outline_version_id uuid,
  latest_draft_version_id uuid,
  current_candidate_draft_id uuid,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.task_files (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.writing_tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  original_filename text not null,
  storage_path text not null,
  extracted_text text not null default '',
  role public.task_file_role not null default 'unknown',
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.task_outputs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.writing_tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  output_kind public.task_output_kind not null,
  storage_path text not null,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.outline_versions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.writing_tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  english_outline text not null,
  chinese_outline text,
  feedback text not null default '',
  is_approved boolean not null default false,
  target_word_count integer not null check (target_word_count > 0),
  citation_style text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.draft_versions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.writing_tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  body_markdown text not null,
  body_word_count integer not null default 0 check (body_word_count >= 0),
  references_markdown text not null default '',
  is_active boolean not null default false,
  is_candidate boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.reference_checks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.writing_tasks(id) on delete cascade,
  draft_version_id uuid references public.draft_versions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  raw_reference text not null,
  detected_title text,
  detected_year text,
  detected_doi text,
  detected_url text,
  verdict public.reference_verdict not null,
  reasoning text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.quota_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid references public.writing_tasks(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  entry_kind text not null,
  amount integer not null,
  balance_recharge_after integer not null default 0,
  balance_subscription_after integer not null default 0,
  balance_frozen_after integer not null default 0,
  unique_event_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint quota_ledger_entries_unique_event_key_key unique (unique_event_key)
);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid references public.profiles(id) on delete set null,
  task_id uuid references public.writing_tasks(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.writing_tasks
  add constraint writing_tasks_primary_requirement_file_fk
  foreign key (primary_requirement_file_id)
  references public.task_files(id)
  on delete set null;

alter table public.writing_tasks
  add constraint writing_tasks_latest_outline_version_fk
  foreign key (latest_outline_version_id)
  references public.outline_versions(id)
  on delete set null;

alter table public.writing_tasks
  add constraint writing_tasks_latest_draft_version_fk
  foreign key (latest_draft_version_id)
  references public.draft_versions(id)
  on delete set null;

alter table public.writing_tasks
  add constraint writing_tasks_current_candidate_draft_fk
  foreign key (current_candidate_draft_id)
  references public.draft_versions(id)
  on delete set null;

create unique index task_outputs_one_active_kind_per_task_idx
  on public.task_outputs (task_id, output_kind)
  where is_active = true;

create unique index outline_versions_task_version_idx
  on public.outline_versions (task_id, version_number);

create unique index draft_versions_task_version_idx
  on public.draft_versions (task_id, version_number);

create index orders_user_created_idx on public.orders (user_id, created_at desc);
create index payment_attempts_order_created_idx on public.payment_attempts (order_id, created_at desc);
create index writing_tasks_user_created_idx on public.writing_tasks (user_id, created_at desc);
create index task_files_task_created_idx on public.task_files (task_id, created_at desc);
create index task_outputs_task_created_idx on public.task_outputs (task_id, created_at desc);
create index reference_checks_task_created_idx on public.reference_checks (task_id, created_at desc);
create index quota_ledger_user_created_idx on public.quota_ledger_entries (user_id, created_at desc);
create index admin_audit_logs_actor_created_idx on public.admin_audit_logs (actor_user_id, created_at desc);

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger set_quota_wallets_updated_at
before update on public.quota_wallets
for each row
execute function public.set_updated_at();

create trigger set_pricing_plans_updated_at
before update on public.pricing_plans
for each row
execute function public.set_updated_at();

create trigger set_orders_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

create trigger set_payment_attempts_updated_at
before update on public.payment_attempts
for each row
execute function public.set_updated_at();

create trigger set_writing_tasks_updated_at
before update on public.writing_tasks
for each row
execute function public.set_updated_at();

create trigger set_task_files_updated_at
before update on public.task_files
for each row
execute function public.set_updated_at();

create trigger set_task_outputs_updated_at
before update on public.task_outputs
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.quota_wallets enable row level security;
alter table public.quota_ledger_entries enable row level security;
alter table public.pricing_plans enable row level security;
alter table public.orders enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.writing_tasks enable row level security;
alter table public.task_files enable row level security;
alter table public.task_outputs enable row level security;
alter table public.outline_versions enable row level security;
alter table public.draft_versions enable row level security;
alter table public.reference_checks enable row level security;
alter table public.admin_audit_logs enable row level security;

create policy "profiles self read"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "profiles self update"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles admin all"
  on public.profiles
  for all
  using (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  );

create policy "quota wallets user read"
  on public.quota_wallets
  for select
  using (auth.uid() = user_id);

create policy "quota wallets admin all"
  on public.quota_wallets
  for all
  using (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  );

create policy "user owned rows readable"
  on public.quota_ledger_entries
  for select
  using (auth.uid() = user_id);

create policy "user owned rows readable orders"
  on public.orders
  for select
  using (auth.uid() = user_id);

create policy "user owned rows readable payment attempts"
  on public.payment_attempts
  for select
  using (auth.uid() = user_id);

create policy "pricing plans public read"
  on public.pricing_plans
  for select
  using (status = 'active');

create policy "user owned rows all writing tasks"
  on public.writing_tasks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user owned rows all task files"
  on public.task_files
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user owned rows all task outputs"
  on public.task_outputs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user owned rows all outline versions"
  on public.outline_versions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user owned rows all draft versions"
  on public.draft_versions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user owned rows all reference checks"
  on public.reference_checks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "admin readable ledger"
  on public.quota_ledger_entries
  for all
  using (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  );

create policy "admin readable orders"
  on public.orders
  for all
  using (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  );

create policy "admin readable payment attempts"
  on public.payment_attempts
  for all
  using (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  );

create policy "admin readable pricing plans"
  on public.pricing_plans
  for all
  using (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  );

create policy "admin readable task rows"
  on public.writing_tasks
  for all
  using (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  );

create policy "admin readable task file rows"
  on public.task_files
  for all
  using (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  );

create policy "admin readable task output rows"
  on public.task_outputs
  for all
  using (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  );

create policy "admin readable outline rows"
  on public.outline_versions
  for all
  using (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  );

create policy "admin readable draft rows"
  on public.draft_versions
  for all
  using (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  );

create policy "admin readable reference rows"
  on public.reference_checks
  for all
  using (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  );

create policy "admin audit logs read"
  on public.admin_audit_logs
  for select
  using (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  );

create policy "admin audit logs insert"
  on public.admin_audit_logs
  for insert
  with check (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  );

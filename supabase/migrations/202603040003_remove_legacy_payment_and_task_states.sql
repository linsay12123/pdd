with latest_freeze_entries as (
  select distinct on (task_id)
    task_id,
    user_id,
    amount
  from public.quota_ledger_entries
  where entry_kind = 'task_freeze'
  order by task_id, created_at desc
),
legacy_frozen_tasks as (
  select
    wt.id as task_id,
    wt.user_id,
    coalesce((wt.quota_reservation ->> 'totalAmount')::integer, lfe.amount, 0) as total_amount,
    coalesce((wt.quota_reservation ->> 'fromSubscription')::integer, 0) as from_subscription,
    coalesce(
      (wt.quota_reservation ->> 'fromRecharge')::integer,
      case
        when wt.quota_reservation ? 'totalAmount'
          then greatest(
            coalesce((wt.quota_reservation ->> 'totalAmount')::integer, 0) -
            coalesce((wt.quota_reservation ->> 'fromSubscription')::integer, 0),
            0
          )
        else coalesce(lfe.amount, 0)
      end
    ) as from_recharge
  from public.writing_tasks as wt
  left join latest_freeze_entries as lfe
    on lfe.task_id = wt.id
   and lfe.user_id = wt.user_id
  where wt.status = 'quota_frozen'
),
wallet_release as (
  update public.quota_wallets as qw
  set
    recharge_quota = qw.recharge_quota + lft.from_recharge,
    subscription_quota = qw.subscription_quota + lft.from_subscription,
    frozen_quota = greatest(0, qw.frozen_quota - lft.total_amount)
  from legacy_frozen_tasks as lft
  where lft.total_amount > 0
    and qw.user_id = lft.user_id
  returning
    lft.task_id,
    lft.user_id,
    lft.total_amount,
    lft.from_recharge,
    lft.from_subscription,
    qw.recharge_quota as balance_recharge_after,
    qw.subscription_quota as balance_subscription_after,
    qw.frozen_quota as balance_frozen_after
)
insert into public.quota_ledger_entries (
  user_id,
  task_id,
  entry_kind,
  amount,
  balance_recharge_after,
  balance_subscription_after,
  balance_frozen_after,
  unique_event_key,
  metadata
)
select
  wr.user_id,
  wr.task_id,
  'task_release',
  wr.total_amount,
  wr.balance_recharge_after,
  wr.balance_subscription_after,
  wr.balance_frozen_after,
  wr.task_id::text || ':legacy_cleanup_release:' || wr.total_amount::text,
  jsonb_build_object(
    'note', 'Legacy cleanup: released old frozen quota before removing quota_frozen status',
    'fromRecharge', wr.from_recharge,
    'fromSubscription', wr.from_subscription
  )
from wallet_release as wr
where wr.total_amount > 0
on conflict (unique_event_key) do nothing;

update public.writing_tasks
set status = case
  when status = 'quota_frozen' then 'failed'::public.task_status
  when status = 'extracting_files' then 'failed'::public.task_status
  when status = 'building_rule_card' then 'failed'::public.task_status
  when status = 'outline_ready' then 'awaiting_outline_approval'::public.task_status
  else status
end
where status in ('quota_frozen', 'extracting_files', 'building_rule_card', 'outline_ready');

alter table public.quota_ledger_entries
  drop column if exists order_id;

drop table if exists public.payment_attempts cascade;
drop table if exists public.orders cascade;
drop table if exists public.pricing_plans cascade;
drop table if exists public.subscriptions cascade;

create type public.task_status_next as enum (
  'created',
  'awaiting_primary_file_confirmation',
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

alter table public.writing_tasks
  alter column status drop default;

alter table public.writing_tasks
  alter column status type public.task_status_next
  using (
    case status::text
      when 'quota_frozen' then 'failed'
      when 'extracting_files' then 'failed'
      when 'building_rule_card' then 'failed'
      when 'outline_ready' then 'awaiting_outline_approval'
      else status::text
    end
  )::public.task_status_next;

drop type if exists public.task_status;
alter type public.task_status_next rename to task_status;

alter table public.writing_tasks
  alter column status set default 'created'::public.task_status;

drop type if exists public.payment_attempt_status;
drop type if exists public.payment_provider;
drop type if exists public.order_status;
drop type if exists public.pricing_plan_status;
drop type if exists public.pricing_plan_kind;

create or replace function public.get_app_schema_health()
returns jsonb
language sql
security definer
set search_path = public, information_schema
stable
as $$
  select jsonb_build_object(
    'targetWordCountNullable',
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'writing_tasks'
          and column_name = 'target_word_count'
          and is_nullable = 'YES'
      ),
    'citationStyleNullable',
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'writing_tasks'
          and column_name = 'citation_style'
          and is_nullable = 'YES'
      ),
    'analysisFieldsReady',
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'writing_tasks'
          and column_name = 'analysis_snapshot'
      )
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'writing_tasks'
          and column_name = 'analysis_status'
      )
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'writing_tasks'
          and column_name = 'analysis_model'
      )
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'writing_tasks'
          and column_name = 'analysis_completed_at'
      ),
    'taskFileFieldsReady',
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'task_files'
          and column_name = 'content_type'
      )
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'task_files'
          and column_name = 'extraction_method'
      )
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'task_files'
          and column_name = 'extraction_warnings'
      )
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'task_files'
          and column_name = 'openai_file_id'
      )
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'task_files'
          and column_name = 'openai_upload_status'
      ),
    'legacyPaymentTablesRemaining',
      coalesce((
        select jsonb_agg(t.table_name order by t.table_name)
        from information_schema.tables as t
        where t.table_schema = 'public'
          and t.table_name in ('pricing_plans', 'orders', 'payment_attempts', 'subscriptions')
      ), '[]'::jsonb),
    'legacyPaymentTypesRemaining',
      coalesce((
        select jsonb_agg(t.typname order by t.typname)
        from pg_type as t
        join pg_namespace as n
          on n.oid = t.typnamespace
        where n.nspname = 'public'
          and t.typname in (
            'pricing_plan_kind',
            'pricing_plan_status',
            'order_status',
            'payment_provider',
            'payment_attempt_status'
          )
      ), '[]'::jsonb),
    'legacyTaskStatusesRemaining',
      coalesce((
        select jsonb_agg(e.enumlabel order by e.enumlabel)
        from pg_type as t
        join pg_namespace as n
          on n.oid = t.typnamespace
        join pg_enum as e
          on e.enumtypid = t.oid
        where n.nspname = 'public'
          and t.typname = 'task_status'
          and e.enumlabel in ('quota_frozen', 'extracting_files', 'building_rule_card', 'outline_ready')
      ), '[]'::jsonb)
  );
$$;

grant execute on function public.get_app_schema_health() to authenticated;
grant execute on function public.get_app_schema_health() to service_role;

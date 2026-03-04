do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'humanize_status'
  ) then
    create type public.humanize_status as enum (
      'idle',
      'queued',
      'processing',
      'retrying',
      'completed',
      'failed'
    );
  end if;
end
$$;

alter table public.writing_tasks
  add column if not exists humanize_status public.humanize_status not null default 'idle';

alter table public.writing_tasks
  add column if not exists humanize_provider text;

alter table public.writing_tasks
  add column if not exists humanize_profile_snapshot jsonb not null default '{}'::jsonb;

alter table public.writing_tasks
  add column if not exists humanize_document_id text;

alter table public.writing_tasks
  add column if not exists humanize_retry_document_id text;

alter table public.writing_tasks
  add column if not exists humanize_error_message text;

alter table public.writing_tasks
  add column if not exists humanize_requested_at timestamptz;

alter table public.writing_tasks
  add column if not exists humanize_completed_at timestamptz;

update public.writing_tasks
set status = 'deliverable_ready'::public.task_status
where status in ('humanizing', 'humanized_ready');

create type public.task_status_next_humanize as enum (
  'created',
  'awaiting_primary_file_confirmation',
  'awaiting_outline_approval',
  'drafting',
  'adjusting_word_count',
  'verifying_references',
  'exporting',
  'deliverable_ready',
  'failed',
  'expired'
);

alter table public.writing_tasks
  alter column status drop default;

alter table public.writing_tasks
  alter column status type public.task_status_next_humanize
  using (
    case status::text
      when 'humanizing' then 'deliverable_ready'
      when 'humanized_ready' then 'deliverable_ready'
      else status::text
    end
  )::public.task_status_next_humanize;

drop type if exists public.task_status;
alter type public.task_status_next_humanize rename to task_status;

alter table public.writing_tasks
  alter column status set default 'created'::public.task_status;

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
    'humanizeFieldsReady',
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'writing_tasks'
          and column_name = 'humanize_status'
      )
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'writing_tasks'
          and column_name = 'humanize_provider'
      )
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'writing_tasks'
          and column_name = 'humanize_profile_snapshot'
      )
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'writing_tasks'
          and column_name = 'humanize_document_id'
      )
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'writing_tasks'
          and column_name = 'humanize_retry_document_id'
      )
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'writing_tasks'
          and column_name = 'humanize_error_message'
      )
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'writing_tasks'
          and column_name = 'humanize_requested_at'
      )
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'writing_tasks'
          and column_name = 'humanize_completed_at'
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
          and e.enumlabel in (
            'quota_frozen',
            'extracting_files',
            'building_rule_card',
            'outline_ready',
            'humanizing',
            'humanized_ready'
          )
      ), '[]'::jsonb)
  );
$$;

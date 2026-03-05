alter table public.writing_tasks
  add column if not exists analysis_trigger_run_id text;

alter table public.writing_tasks
  add column if not exists analysis_requested_at timestamptz;

alter table public.writing_tasks
  add column if not exists analysis_started_at timestamptz;

update public.writing_tasks
set analysis_requested_at = coalesce(analysis_requested_at, updated_at)
where analysis_status = 'pending'
  and analysis_requested_at is null;

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
          and column_name = 'analysis_trigger_run_id'
      )
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'writing_tasks'
          and column_name = 'analysis_requested_at'
      )
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'writing_tasks'
          and column_name = 'analysis_started_at'
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
        join pg_namespace as n on n.oid = t.typnamespace
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
        select jsonb_agg(v order by v)
        from unnest(enum_range(null::public.task_status)::text[]) as v
        where v in (
          'quota_frozen',
          'extracting_files',
          'building_rule_card',
          'outline_ready'
        )
      ), '[]'::jsonb)
  );
$$;


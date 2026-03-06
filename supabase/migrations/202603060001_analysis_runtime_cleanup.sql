alter table public.writing_tasks
  add column if not exists analysis_retry_count integer not null default 0;

alter table public.writing_tasks
  add column if not exists analysis_error_message text;

update public.writing_tasks
set analysis_model = 'gpt-5.2'
where analysis_model like 'analysis_auto_recovered' || '_once';

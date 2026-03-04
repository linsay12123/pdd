alter table public.writing_tasks
  alter column target_word_count drop not null,
  alter column citation_style drop not null;

alter table public.writing_tasks
  add column if not exists analysis_snapshot jsonb,
  add column if not exists analysis_status text not null default 'pending',
  add column if not exists analysis_model text,
  add column if not exists analysis_completed_at timestamptz;

alter table public.task_files
  add column if not exists content_type text,
  add column if not exists extraction_method text,
  add column if not exists extraction_warnings jsonb not null default '[]'::jsonb,
  add column if not exists openai_file_id text,
  add column if not exists openai_upload_status text not null default 'pending';

update public.writing_tasks
set analysis_status = 'pending'
where analysis_status is null;

update public.task_files
set extraction_warnings = '[]'::jsonb
where extraction_warnings is null;

update public.task_files
set openai_upload_status = 'pending'
where openai_upload_status is null;

alter table public.writing_tasks
  add constraint writing_tasks_analysis_status_check
  check (analysis_status in ('pending', 'succeeded', 'failed'));

alter table public.task_files
  add constraint task_files_openai_upload_status_check
  check (openai_upload_status in ('pending', 'uploaded', 'failed'));

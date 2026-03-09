-- Record the real timestamps for each post-approval workflow stage so the UI can
-- show the actual path the task has passed through instead of guessing from one
-- current status value.

alter table public.writing_tasks
  add column if not exists workflow_stage_timestamps jsonb not null default '{}'::jsonb;

update public.writing_tasks
set workflow_stage_timestamps = '{}'::jsonb
where workflow_stage_timestamps is null;

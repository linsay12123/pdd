-- Track post-outline workflow attempts and the last stage reached in the writing pipeline.

alter table public.writing_tasks
  add column if not exists approval_attempt_count integer;

update public.writing_tasks
set approval_attempt_count = 0
where approval_attempt_count is null;

alter table public.writing_tasks
  alter column approval_attempt_count set default 0;

alter table public.writing_tasks
  alter column approval_attempt_count set not null;

alter table public.writing_tasks
  add column if not exists last_workflow_stage text;

update public.writing_tasks
set last_workflow_stage = status
where last_workflow_stage is null
  and status in ('drafting', 'adjusting_word_count', 'verifying_references', 'exporting');

alter table public.writing_tasks
  drop constraint if exists writing_tasks_last_workflow_stage_check;

alter table public.writing_tasks
  add constraint writing_tasks_last_workflow_stage_check
  check (
    last_workflow_stage is null
    or last_workflow_stage in ('drafting', 'adjusting_word_count', 'verifying_references', 'exporting')
  );

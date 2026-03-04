-- Store the frozen quota reservation on each task so we can release it on cancel.
alter table public.writing_tasks
  add column if not exists quota_reservation jsonb;

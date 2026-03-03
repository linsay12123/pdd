-- Store the frozen quota reservation on each task so we can release it on cancel.
alter table public.writing_tasks
  add column quota_reservation jsonb;

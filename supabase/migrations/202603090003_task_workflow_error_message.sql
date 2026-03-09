-- Persist the exact workflow failure reason so the UI can show the real cause
-- instead of falling back to a generic post-approval error message.
alter table if exists public.writing_tasks
  add column if not exists workflow_error_message text;

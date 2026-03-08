update public.task_outputs
set
  expires_at = created_at + interval '3 days',
  updated_at = timezone('utc', now())
where expires_at is null;

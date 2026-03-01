select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles',
    'quota_wallets',
    'quota_ledger_entries',
    'pricing_plans',
    'orders',
    'payment_attempts',
    'writing_tasks',
    'task_files',
    'task_outputs',
    'outline_versions',
    'draft_versions',
    'reference_checks',
    'admin_audit_logs'
  )
order by table_name;

create or replace function public.is_current_user_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

drop policy if exists "profiles admin all" on public.profiles;
create policy "profiles admin all"
  on public.profiles
  for all
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

drop policy if exists "quota wallets admin all" on public.quota_wallets;
create policy "quota wallets admin all"
  on public.quota_wallets
  for all
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

drop policy if exists "admin readable ledger" on public.quota_ledger_entries;
create policy "admin readable ledger"
  on public.quota_ledger_entries
  for all
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

drop policy if exists "admin readable orders" on public.orders;
create policy "admin readable orders"
  on public.orders
  for all
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

drop policy if exists "admin readable payment attempts" on public.payment_attempts;
create policy "admin readable payment attempts"
  on public.payment_attempts
  for all
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

drop policy if exists "admin readable pricing plans" on public.pricing_plans;
create policy "admin readable pricing plans"
  on public.pricing_plans
  for all
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

drop policy if exists "admin readable task rows" on public.writing_tasks;
create policy "admin readable task rows"
  on public.writing_tasks
  for all
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

drop policy if exists "admin readable task file rows" on public.task_files;
create policy "admin readable task file rows"
  on public.task_files
  for all
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

drop policy if exists "admin readable task output rows" on public.task_outputs;
create policy "admin readable task output rows"
  on public.task_outputs
  for all
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

drop policy if exists "admin readable outline rows" on public.outline_versions;
create policy "admin readable outline rows"
  on public.outline_versions
  for all
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

drop policy if exists "admin readable draft rows" on public.draft_versions;
create policy "admin readable draft rows"
  on public.draft_versions
  for all
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

drop policy if exists "admin readable reference rows" on public.reference_checks;
create policy "admin readable reference rows"
  on public.reference_checks
  for all
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

drop policy if exists "admin audit logs read" on public.admin_audit_logs;
create policy "admin audit logs read"
  on public.admin_audit_logs
  for select
  using (public.is_current_user_admin());

drop policy if exists "admin audit logs insert" on public.admin_audit_logs;
create policy "admin audit logs insert"
  on public.admin_audit_logs
  for insert
  with check (public.is_current_user_admin());

create or replace function public.finalize_approved_task_startup_failure(
  p_task_id uuid,
  p_user_id uuid,
  p_expected_approval_attempt_count integer,
  p_mode text,
  p_previous_status text default null,
  p_previous_last_workflow_stage text default null,
  p_previous_workflow_stage_timestamps jsonb default '{}'::jsonb,
  p_previous_workflow_error_message text default null,
  p_failure_message text default null
)
returns table (
  applied boolean,
  released boolean,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.writing_tasks%rowtype;
  v_reservation jsonb;
  v_from_recharge integer;
  v_from_subscription integer;
  v_total_amount integer;
  v_reservation_id text;
  v_release_note text;
  v_failed_at text;
  v_next_status text;
  v_released boolean := false;
begin
  select *
  into v_task
  from public.writing_tasks as wt
  where wt.id = p_task_id
    and wt.user_id = p_user_id
  for update;

  if not found then
    return query select false, false, null::text;
    return;
  end if;

  if coalesce(v_task.approval_attempt_count, 0) <> p_expected_approval_attempt_count then
    return query select false, false, v_task.status;
    return;
  end if;

  v_reservation := v_task.quota_reservation;

  if v_reservation is not null then
    v_from_recharge := coalesce((v_reservation ->> 'fromRecharge')::integer, 0);
    v_from_subscription := coalesce((v_reservation ->> 'fromSubscription')::integer, 0);
    v_total_amount := coalesce((v_reservation ->> 'totalAmount')::integer, 0);
    v_reservation_id := nullif(v_reservation ->> 'reservationId', '');
    v_release_note := format(
      'Released %s quota for %s',
      v_total_amount,
      coalesce(nullif(v_reservation ->> 'chargePath', ''), 'generation')
    );

    insert into public.quota_wallets (
      user_id,
      recharge_quota,
      subscription_quota,
      frozen_quota
    )
    values (p_user_id, 0, 0, 0)
    on conflict (user_id) do nothing;

    update public.quota_wallets as qw
    set
      recharge_quota = qw.recharge_quota + v_from_recharge,
      subscription_quota = qw.subscription_quota + v_from_subscription,
      frozen_quota = greatest(qw.frozen_quota - v_total_amount, 0)
    where qw.user_id = p_user_id;

    insert into public.quota_ledger_entries (
      user_id,
      task_id,
      entry_kind,
      amount,
      balance_recharge_after,
      balance_subscription_after,
      balance_frozen_after,
      unique_event_key,
      metadata
    )
    select
      p_user_id,
      p_task_id,
      'task_release',
      v_total_amount,
      qw.recharge_quota,
      qw.subscription_quota,
      qw.frozen_quota,
      coalesce(v_reservation_id, gen_random_uuid()::text),
      jsonb_build_object('note', v_release_note)
    from public.quota_wallets as qw
    where qw.user_id = p_user_id
    on conflict (unique_event_key) do nothing;

    v_released := true;
  end if;

  if p_mode = 'revert' then
    update public.writing_tasks as wt
    set
      status = coalesce(p_previous_status, 'awaiting_outline_approval'),
      last_workflow_stage = p_previous_last_workflow_stage,
      workflow_error_message = p_previous_workflow_error_message,
      workflow_stage_timestamps = coalesce(p_previous_workflow_stage_timestamps, '{}'::jsonb),
      quota_reservation = null
    where wt.id = p_task_id
      and wt.user_id = p_user_id;
  else
    v_failed_at := to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

    update public.writing_tasks as wt
    set
      status = 'failed',
      last_workflow_stage = coalesce(wt.last_workflow_stage, 'drafting'),
      workflow_error_message = coalesce(nullif(p_failure_message, ''), wt.workflow_error_message),
      workflow_stage_timestamps = coalesce(wt.workflow_stage_timestamps, '{}'::jsonb) || jsonb_build_object('failed', v_failed_at),
      quota_reservation = null
    where wt.id = p_task_id
      and wt.user_id = p_user_id;
  end if;

  select wt.status
  into v_next_status
  from public.writing_tasks as wt
  where wt.id = p_task_id
    and wt.user_id = p_user_id;

  return query select true, v_released, v_next_status;
end;
$$;

grant execute on function public.finalize_approved_task_startup_failure(
  uuid,
  uuid,
  integer,
  text,
  text,
  text,
  jsonb,
  text,
  text
) to service_role;

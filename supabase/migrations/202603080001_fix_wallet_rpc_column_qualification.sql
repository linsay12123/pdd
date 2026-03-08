create or replace function public.apply_quota_wallet_mutation(
  p_user_id uuid,
  p_task_id uuid,
  p_expected_recharge integer,
  p_expected_subscription integer,
  p_expected_frozen integer,
  p_next_recharge integer,
  p_next_subscription integer,
  p_next_frozen integer,
  p_entry_kind text,
  p_amount integer,
  p_unique_event_key text,
  p_note text,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  applied boolean,
  conflict boolean,
  recharge_quota integer,
  subscription_quota integer,
  frozen_quota integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recharge integer;
  v_subscription integer;
  v_frozen integer;
begin
  insert into public.quota_wallets (
    user_id,
    recharge_quota,
    subscription_quota,
    frozen_quota
  )
  values (p_user_id, 0, 0, 0)
  on conflict (user_id) do nothing;

  if p_next_recharge < 0 or p_next_subscription < 0 or p_next_frozen < 0 then
    raise exception 'WALLET_NEGATIVE_NOT_ALLOWED';
  end if;

  update public.quota_wallets as qw
  set
    recharge_quota = p_next_recharge,
    subscription_quota = p_next_subscription,
    frozen_quota = p_next_frozen
  where qw.user_id = p_user_id
    and qw.recharge_quota = p_expected_recharge
    and qw.subscription_quota = p_expected_subscription
    and qw.frozen_quota = p_expected_frozen
  returning qw.recharge_quota, qw.subscription_quota, qw.frozen_quota
  into v_recharge, v_subscription, v_frozen;

  if not found then
    select
      qw.recharge_quota,
      qw.subscription_quota,
      qw.frozen_quota
    into
      v_recharge,
      v_subscription,
      v_frozen
    from public.quota_wallets as qw
    where qw.user_id = p_user_id;

    return query select false, true, v_recharge, v_subscription, v_frozen;
    return;
  end if;

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
  values (
    p_user_id,
    p_task_id,
    p_entry_kind,
    p_amount,
    v_recharge,
    v_subscription,
    v_frozen,
    p_unique_event_key,
    jsonb_build_object('note', p_note) || coalesce(p_metadata, '{}'::jsonb)
  );

  return query select true, false, v_recharge, v_subscription, v_frozen;
end;
$$;

create or replace function public.redeem_activation_code_and_credit_wallet(
  p_user_id uuid,
  p_code text
)
returns table (
  code text,
  tier integer,
  quota_amount integer,
  recharge_quota integer,
  frozen_quota integer
)
language plpgsql
as $$
declare
  v_code text := upper(trim(p_code));
  v_tier integer;
  v_quota integer;
  v_recharge integer;
  v_frozen integer;
begin
  if v_code is null or v_code = '' then
    raise exception 'ACTIVATION_CODE_EMPTY';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_user_id
  ) then
    raise exception 'USER_NOT_FOUND';
  end if;

  select ac.tier, ac.quota_amount
  into v_tier, v_quota
  from public.activation_codes as ac
  where ac.code = v_code
  for update;

  if not found then
    raise exception 'ACTIVATION_CODE_NOT_FOUND';
  end if;

  update public.activation_codes as ac
  set status = 'used',
      used_by_user_id = p_user_id,
      used_at = timezone('utc', now())
  where ac.code = v_code
    and ac.status = 'unused';

  if not found then
    raise exception 'ACTIVATION_CODE_ALREADY_USED';
  end if;

  insert into public.quota_wallets (
    user_id,
    recharge_quota,
    subscription_quota,
    frozen_quota
  )
  values (
    p_user_id,
    0,
    0,
    0
  )
  on conflict (user_id) do nothing;

  update public.quota_wallets as qw
  set recharge_quota = qw.recharge_quota + v_quota
  where qw.user_id = p_user_id
  returning qw.recharge_quota, qw.frozen_quota
  into v_recharge, v_frozen;

  insert into public.quota_ledger_entries (
    user_id,
    entry_kind,
    amount,
    balance_recharge_after,
    balance_subscription_after,
    balance_frozen_after,
    unique_event_key,
    metadata
  )
  values (
    p_user_id,
    'activation_credit',
    v_quota,
    v_recharge,
    0,
    v_frozen,
    'activation:' || v_code,
    jsonb_build_object(
      'note',
      'Redeemed activation code ' || v_code
    )
  );

  return query
  select
    v_code,
    v_tier,
    v_quota,
    v_recharge,
    v_frozen;
end;
$$;

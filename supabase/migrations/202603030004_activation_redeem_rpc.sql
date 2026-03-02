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
  from public.activation_codes ac
  where ac.code = v_code
  for update;

  if not found then
    raise exception 'ACTIVATION_CODE_NOT_FOUND';
  end if;

  update public.activation_codes
  set status = 'used',
      used_by_user_id = p_user_id,
      used_at = timezone('utc', now())
  where code = v_code
    and status = 'unused';

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

  update public.quota_wallets
  set recharge_quota = recharge_quota + v_quota
  where user_id = p_user_id
  returning recharge_quota, frozen_quota
  into v_recharge, v_frozen;

  return query
  select
    v_code,
    v_tier,
    v_quota,
    v_recharge,
    v_frozen;
end;
$$;

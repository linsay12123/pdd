revoke all on function public.apply_quota_wallet_mutation(
  uuid,
  uuid,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  text,
  integer,
  text,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.apply_quota_wallet_mutation(
  uuid,
  uuid,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  text,
  integer,
  text,
  text,
  jsonb
) to service_role;

revoke all on function public.redeem_activation_code_and_credit_wallet(
  uuid,
  text
) from public, anon, authenticated;

grant execute on function public.redeem_activation_code_and_credit_wallet(
  uuid,
  text
) to service_role;

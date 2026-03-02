create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    display_name,
    role,
    is_frozen
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    'user',
    false
  )
  on conflict (id) do update
  set email = excluded.email,
      display_name = case
        when coalesce(public.profiles.display_name, '') = '' then excluded.display_name
        else public.profiles.display_name
      end;

  insert into public.quota_wallets (
    user_id,
    recharge_quota,
    subscription_quota,
    frozen_quota
  )
  values (
    new.id,
    0,
    0,
    0
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

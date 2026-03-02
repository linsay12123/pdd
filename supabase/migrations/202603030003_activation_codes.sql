create table if not exists public.activation_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  tier integer not null check (tier in (1000, 5000, 10000, 20000)),
  quota_amount integer not null check (quota_amount > 0),
  status text not null default 'unused' check (status in ('unused', 'used')),
  used_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  used_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists activation_codes_status_created_idx
  on public.activation_codes (status, created_at desc);

create trigger set_activation_codes_updated_at
before update on public.activation_codes
for each row
execute function public.set_updated_at();

alter table public.activation_codes enable row level security;

create policy "activation codes admin all"
  on public.activation_codes
  for all
  using (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  );

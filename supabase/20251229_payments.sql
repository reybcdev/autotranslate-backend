-- Enable required extensions
create extension if not exists "pgcrypto";

-- Ensure profiles has a credits column for balance tracking
alter table if exists public.profiles
  add column if not exists credits integer not null default 0;

comment on column public.profiles.credits is 'Number of translation credits available to the user';

-- Payments audit table
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  stripe_session_id text unique,
  stripe_payment_intent text,
  amount bigint not null,
  currency text not null default 'usd',
  plan text,
  credits_added integer not null default 0,
  status text not null default 'completed',
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Ensure new billing columns exist even if payments table already existed
alter table if exists public.payments
  add column if not exists usage_type text not null default 'plan',
  add column if not exists pricing_basis jsonb,
  add column if not exists translation_id uuid references public.translations (id) on delete set null,
  add column if not exists consumed boolean not null default false,
  add column if not exists subscription_id text,
  add column if not exists billing_reference text unique;

comment on table public.payments is 'Stripe checkout receipts for credit purchases and per-translation payments';
comment on column public.payments.usage_type is 'plan purchases vs translation one-off payments';
comment on column public.payments.pricing_basis is 'Stored pricing input for one-off translations';
comment on column public.payments.translation_id is 'Translation that consumed this payment';
comment on column public.payments.consumed is 'Flag indicating payment already used';
comment on column public.payments.subscription_id is 'Stripe subscription id for recurring plans';
comment on column public.payments.billing_reference is 'Client generated reference that ties a translation payment to translation creation';

create index if not exists payments_user_id_created_at_idx
  on public.payments (user_id, created_at desc);

-- Row Level Security so users can only see their own payments
alter table public.payments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
      and tablename = 'payments' 
      and policyname = 'payments_select_own'
  ) then
    execute $policy$
      create policy "payments_select_own"
      on public.payments
      for select
      using (auth.uid() = user_id);
    $policy$;
  end if;
end;
$$;

-- Helper function to add credits (invoked from backend + triggers)
do $$
begin
  if exists (
    select 1 from pg_proc
    where proname = 'add_credits'
      and pg_function_is_visible(oid)
  ) then
    drop function public.add_credits(uuid, integer);
  end if;
end;
$$;

create function public.add_credits(user_id uuid, amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
    set credits = coalesce(credits, 0) + amount
  where id = user_id;
end;
$$;

comment on function public.add_credits(uuid, integer) is 'Increment user credits by amount';

-- Helper to deduct a single credit after translation
do $$
begin
  if exists (
    select 1 from pg_proc
    where proname = 'deduct_credit'
      and pg_function_is_visible(oid)
  ) then
    drop function public.deduct_credit(uuid);
  end if;
end;
$$;

create function public.deduct_credit(user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
    set credits = greatest(coalesce(credits, 0) - 1, 0)
  where id = user_id;
end;
$$;

comment on function public.deduct_credit(uuid) is 'Decrement user credits when a translation job starts';

-- Track billing metadata on translations
alter table if exists public.translations
  add column if not exists billing_mode text not null default 'plan',
  add column if not exists payment_id uuid references public.payments (id);

comment on column public.translations.billing_mode is 'plan (credits/subscription) vs one_off payment';
comment on column public.translations.payment_id is 'Payment record that funded this translation when billing_mode = one_off';

create index if not exists translations_payment_id_idx
  on public.translations (payment_id);

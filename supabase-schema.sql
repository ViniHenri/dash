-- =============================================
-- MetaDesk — Schema do Supabase
-- Execute isso no SQL Editor do Supabase
-- =============================================

-- Tabela de clientes
create table clients (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  sector text,
  ad_account_id text,
  page_id text,
  instagram_id text,
  meta_access_token text,
  token_expires_at timestamptz,
  color text default '#4f46e5',
  status text default 'active',
  created_at timestamptz default now()
);

-- Tabela de métricas (cache dos dados do Meta)
create table metrics_cache (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references clients(id) on delete cascade,
  date_range text not null,
  data jsonb not null,
  fetched_at timestamptz default now()
);

-- RLS (Row Level Security) — cada usuário vê só seus dados
alter table clients enable row level security;
alter table metrics_cache enable row level security;

create policy "Users see own clients"
  on clients for all
  using (auth.uid() = user_id);

create policy "Users see own metrics"
  on metrics_cache for all
  using (
    client_id in (
      select id from clients where user_id = auth.uid()
    )
  );

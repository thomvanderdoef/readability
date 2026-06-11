create extension if not exists pgcrypto;

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  is_research boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  slug text not null unique,
  title text not null,
  type text not null check (type in ('book', 'paper', 'article', 'video', 'podcast', 'website')),
  url text,
  authors text[] not null default '{}',
  publisher text,
  published_date date,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tags text[] not null default '{}',
  status text not null default 'unread' check (status in ('unread', 'reading', 'read')),
  date_read date,
  cliff_notes text,
  cliff_notes_model text,
  personal_notes text,
  cover_image_url text,
  source_domain text,
  is_essential boolean not null default false,
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', array_to_string(authors, ' ')), 'B') ||
    setweight(to_tsvector('english', array_to_string(tags, ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(cliff_notes, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(personal_notes, '')), 'C')
  ) stored
);

create index if not exists resources_collection_id_idx on public.resources(collection_id);
create index if not exists resources_status_idx on public.resources(status);
create index if not exists resources_type_idx on public.resources(type);
create index if not exists resources_search_vector_idx on public.resources using gin(search_vector);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists resources_set_updated_at on public.resources;
create trigger resources_set_updated_at
before update on public.resources
for each row
execute function public.set_updated_at();

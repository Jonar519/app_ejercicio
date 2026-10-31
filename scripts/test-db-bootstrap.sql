-- Preparación del contenedor de pruebas (se ejecuta como supabase_admin antes de las migraciones).
create extension if not exists pgtap schema extensions;

-- Réplica mínima de las tablas que en producción crea el servicio de Storage.
create schema if not exists storage;
grant usage on schema storage to postgres, authenticated, anon;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null
);

alter table storage.buckets owner to postgres;
alter table storage.objects owner to postgres;
alter table storage.objects enable row level security;
grant all on storage.objects to authenticated;

create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1];
$$;

create schema tests;
grant usage on schema tests to public;

create function tests.as_user(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_user_id::text, true);
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

create function tests.as_anon() returns void language sql as $$
  select set_config('request.jwt.claim.sub', '', true);
  select set_config('request.jwt.claims', '{"role":"anon"}', true);
  select set_config('role', 'anon', true);
$$;

create function tests.as_admin() returns void language sql as $$
  select set_config('request.jwt.claim.sub', '', true);
  select set_config('request.jwt.claims', '', true);
  select set_config('role', 'postgres', true);
$$;

create function tests.create_user(p_user_id uuid) returns void language sql security definer as $$
  insert into auth.users (id, email) values (p_user_id, p_user_id || '@test.local');
$$;

grant execute on all functions in schema tests to public;

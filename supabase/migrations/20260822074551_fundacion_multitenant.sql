-- planteles: raíz de tenant
create table public.planteles (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default now()
);

alter table public.planteles enable row level security;

-- perfiles: vincula auth.users con plantel_id y rol
create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plantel_id uuid not null references public.planteles(id),
  rol text not null check (rol in ('alumno','docente','administrativo','oficina_central')),
  nombre_completo text not null,
  created_at timestamptz not null default now()
);

alter table public.perfiles enable row level security;
create index idx_perfiles_plantel_id on public.perfiles(plantel_id);

-- helper: plantel_id del usuario autenticado actual
create or replace function public.plantel_id_actual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select plantel_id from public.perfiles where id = auth.uid()
$$;

-- políticas RLS mínimas
create policy "perfiles_select_propio"
  on public.perfiles for select
  using (id = auth.uid());

create policy "planteles_select_propio"
  on public.planteles for select
  using (id = public.plantel_id_actual());

-- TODO: falta política de INSERT/UPDATE para perfiles y planteles; no hay
-- caso de uso de alta de plantel/usuario implementado todavía.
-- TODO: falta el caso de oficina_central viendo varios planteles de la
-- misma red; eso corresponde a la oleada de "red de planteles", no a esta
-- migración mínima.

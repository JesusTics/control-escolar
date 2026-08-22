create table public.alumnos (
  id uuid primary key default gen_random_uuid(),
  plantel_id uuid not null references public.planteles(id),
  matricula text not null,
  nombre_completo text not null,
  fecha_nacimiento date,
  estado text not null default 'activo' check (estado in ('activo','inactivo')),
  created_at timestamptz not null default now(),
  unique (plantel_id, matricula)
);

alter table public.alumnos enable row level security;
create index idx_alumnos_plantel_id on public.alumnos(plantel_id);

create policy "alumnos_select_mismo_plantel"
  on public.alumnos for select
  using (plantel_id = public.plantel_id_actual());

create policy "alumnos_insert_staff_mismo_plantel"
  on public.alumnos for insert
  with check (
    plantel_id = public.plantel_id_actual()
    and exists (
      select 1 from public.perfiles
      where id = auth.uid() and rol in ('administrativo','oficina_central')
    )
  );

create policy "alumnos_update_staff_mismo_plantel"
  on public.alumnos for update
  using (
    plantel_id = public.plantel_id_actual()
    and exists (
      select 1 from public.perfiles
      where id = auth.uid() and rol in ('administrativo','oficina_central')
    )
  )
  with check (
    plantel_id = public.plantel_id_actual()
  );

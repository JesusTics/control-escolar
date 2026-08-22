create table public.calificaciones (
  id uuid primary key default gen_random_uuid(),
  plantel_id uuid not null references public.planteles(id),
  alumno_id uuid not null references public.alumnos(id),
  materia_id uuid not null references public.materias(id),
  periodo text not null,
  calificacion numeric(4,2) not null check (calificacion >= 0 and calificacion <= 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (alumno_id, materia_id, periodo)
);

alter table public.calificaciones enable row level security;
create index idx_calificaciones_plantel_id on public.calificaciones(plantel_id);
create index idx_calificaciones_alumno_id on public.calificaciones(alumno_id);

create policy "calificaciones_select_mismo_plantel"
  on public.calificaciones for select
  using (plantel_id = public.plantel_id_actual());

create policy "calificaciones_insert_staff_mismo_plantel"
  on public.calificaciones for insert
  with check (
    plantel_id = public.plantel_id_actual()
    and exists (
      select 1 from public.perfiles
      where id = auth.uid() and rol in ('administrativo','oficina_central','docente')
    )
  );

create policy "calificaciones_update_staff_mismo_plantel"
  on public.calificaciones for update
  using (
    plantel_id = public.plantel_id_actual()
    and exists (
      select 1 from public.perfiles
      where id = auth.uid() and rol in ('administrativo','oficina_central','docente')
    )
  )
  with check (
    plantel_id = public.plantel_id_actual()
  );

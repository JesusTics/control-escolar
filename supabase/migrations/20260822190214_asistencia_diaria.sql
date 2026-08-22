-- Módulo Asistencia: asistencia diaria general del plantel (un registro por
-- alumno por día — no por materia/clase individual, ver alcance explícito de
-- la tarea). Mismo patrón de RLS que `alumnos`/`materias`/`calificaciones`.
create table public.asistencias (
  id uuid primary key default gen_random_uuid(),
  plantel_id uuid not null references public.planteles(id),
  alumno_id uuid not null references public.alumnos(id),
  fecha date not null,
  estado text not null check (estado in ('presente','ausente','retardo','justificado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (alumno_id, fecha)
);

alter table public.asistencias enable row level security;
create index idx_asistencias_plantel_id on public.asistencias(plantel_id);
create index idx_asistencias_alumno_id on public.asistencias(alumno_id);

create policy "asistencias_select_mismo_plantel"
  on public.asistencias for select
  using (plantel_id = public.plantel_id_actual());

create policy "asistencias_insert_staff_mismo_plantel"
  on public.asistencias for insert
  with check (
    plantel_id = public.plantel_id_actual()
    and exists (
      select 1 from public.perfiles
      where id = auth.uid() and rol in ('administrativo','oficina_central','docente')
    )
  );

create policy "asistencias_update_staff_mismo_plantel"
  on public.asistencias for update
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

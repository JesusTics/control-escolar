-- Módulo Grupos (Oleada 2, "horarios/carga académica" acotado a su mínimo):
-- reemplaza el modelo anterior de calificaciones/asistencia directas por
-- (materia, periodo) por el modelo real de "grupos" — una instancia concreta
-- de una materia impartida por un docente en un periodo (ej. "Matemáticas —
-- Grupo A"), estilo universidad: un alumno se inscribe individualmente a
-- varios grupos, no un solo grupo fijo tipo primaria.
--
-- Esto reemplaza el propósito de `public.docente_materias`
-- (20260823000049_asignacion_docente_materia.sql): antes un docente podía
-- calificar cualquier alumno en una materia si tenía esa materia asignada en
-- general; ahora la asignación es directamente en el grupo (`grupos.
-- docente_id`), más fino. `docente_materias` se retira por completo en
-- 20260823003340_retirar_docente_materias.sql.

create table public.grupos (
  id uuid primary key default gen_random_uuid(),
  plantel_id uuid not null references public.planteles(id),
  materia_id uuid not null references public.materias(id),
  docente_id uuid references public.perfiles(id),
  nombre text not null,
  periodo text not null,
  created_at timestamptz not null default now(),
  unique (materia_id, nombre, periodo)
);

alter table public.grupos enable row level security;
create index idx_grupos_plantel_id on public.grupos(plantel_id);
create index idx_grupos_docente_id on public.grupos(docente_id);
create index idx_grupos_materia_id on public.grupos(materia_id);

create policy "grupos_select_mismo_plantel"
  on public.grupos for select
  using (plantel_id = public.plantel_id_actual());

create policy "grupos_insert_staff"
  on public.grupos for insert
  with check (
    plantel_id = public.plantel_id_actual()
    and exists (select 1 from public.perfiles where id = auth.uid() and rol in ('administrativo','oficina_central'))
  );

create policy "grupos_update_staff"
  on public.grupos for update
  using (
    plantel_id = public.plantel_id_actual()
    and exists (select 1 from public.perfiles where id = auth.uid() and rol in ('administrativo','oficina_central'))
  )
  with check (plantel_id = public.plantel_id_actual());

create table public.inscripciones (
  id uuid primary key default gen_random_uuid(),
  plantel_id uuid not null references public.planteles(id),
  alumno_id uuid not null references public.alumnos(id),
  grupo_id uuid not null references public.grupos(id),
  created_at timestamptz not null default now(),
  unique (alumno_id, grupo_id)
);

alter table public.inscripciones enable row level security;
create index idx_inscripciones_plantel_id on public.inscripciones(plantel_id);
create index idx_inscripciones_alumno_id on public.inscripciones(alumno_id);
create index idx_inscripciones_grupo_id on public.inscripciones(grupo_id);

create policy "inscripciones_select_propia_o_staff_o_docente"
  on public.inscripciones for select
  using (
    plantel_id = public.plantel_id_actual()
    and (
      exists (select 1 from public.alumnos a where a.id = inscripciones.alumno_id and a.perfil_id = auth.uid())
      or exists (select 1 from public.perfiles where id = auth.uid() and rol in ('administrativo','oficina_central'))
      or exists (select 1 from public.grupos g where g.id = inscripciones.grupo_id and g.docente_id = auth.uid())
    )
  );

create policy "inscripciones_insert_staff"
  on public.inscripciones for insert
  with check (
    plantel_id = public.plantel_id_actual()
    and exists (select 1 from public.perfiles where id = auth.uid() and rol in ('administrativo','oficina_central'))
  );

create policy "inscripciones_delete_staff"
  on public.inscripciones for delete
  using (
    plantel_id = public.plantel_id_actual()
    and exists (select 1 from public.perfiles where id = auth.uid() and rol in ('administrativo','oficina_central'))
  );

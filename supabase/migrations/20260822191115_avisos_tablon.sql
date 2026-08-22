-- Módulo Comunicación: tablón de avisos interno (in-app), no envío real de
-- correo/SMS a padres/tutores. Alcance explícito de esta sesión: no existen
-- todavía datos de contacto de tutores (bloqueados por CLAUDE.md 4.4,
-- cifrado en reposo no resuelto) ni una integración real de proveedor de
-- email — ver detalle en docs/ARCHITECTURE.md, sección "Comunicación".
--
-- Solo alta y lectura por ahora (sin edición ni borrado) — más simple y
-- consistente con "sin sobreingeniería para el MVP" (CLAUDE.md 4.1).

create table public.avisos (
  id uuid primary key default gen_random_uuid(),
  plantel_id uuid not null references public.planteles(id),
  autor_id uuid not null references public.perfiles(id),
  titulo text not null,
  contenido text not null,
  dirigido_a text not null default 'todos' check (dirigido_a in ('todos','docentes','alumnos')),
  created_at timestamptz not null default now()
);

alter table public.avisos enable row level security;
create index idx_avisos_plantel_id on public.avisos(plantel_id);

create policy "avisos_select_mismo_plantel"
  on public.avisos for select
  using (plantel_id = public.plantel_id_actual());

create policy "avisos_insert_staff_mismo_plantel"
  on public.avisos for insert
  with check (
    plantel_id = public.plantel_id_actual()
    and autor_id = auth.uid()
    and exists (
      select 1 from public.perfiles
      where id = auth.uid() and rol in ('administrativo','oficina_central')
    )
  );

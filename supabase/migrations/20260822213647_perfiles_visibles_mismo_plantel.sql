-- Amplía la visibilidad de `perfiles` de "solo mi propia fila" a "todo mi
-- plantel" — corrige el bug cosmético de "Autor desconocido" en avisos.
--
-- Causa raíz: `perfiles_select_propio` (política original,
-- supabase/migrations/20260822075713_alta_inicial_identidad.sql, aunque
-- fue definida ya desde 20260822074551_fundacion_multitenant.sql) solo deja
-- a un usuario ver su PROPIA fila (`id = auth.uid()`). El join de
-- `listar-avisos.ts` a `perfiles.nombre_completo` para mostrar el autor de
-- un aviso falla por RLS para cualquiera que no sea el autor mismo, y el
-- nombre sale null.
--
-- El nombre/rol de un colega del mismo plantel no es información sensible
-- (a diferencia de los campos cifrados de `alumnos`, protegidos aparte por
-- CLAUDE.md 4.4) — es consistente con `materias_select_mismo_plantel` y con
-- el propósito de `avisos` (mostrar el autor a cualquiera del plantel que
-- pueda ver el aviso). No afecta el aislamiento ENTRE planteles: sigue
-- acotado por `plantel_id_actual()`.
--
-- `plantel_id_actual()` es `security definer` y no depende de esta política
-- (corre con los privilegios del owner de la función, no del invocador), así
-- que este cambio no la afecta.
drop policy "perfiles_select_propio" on public.perfiles;

create policy "perfiles_select_mismo_plantel"
  on public.perfiles for select
  using (plantel_id = public.plantel_id_actual());

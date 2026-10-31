## Resumen

<!-- Qué cambia y por qué. -->

## Criterios de aceptación

- [ ]

## Verificación

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `npm run test:db` (si cambia `supabase/`)

## Seguridad

- [ ] Sin secretos ni archivos `.env*` en el diff
- [ ] Tablas nuevas con RLS forzado y pruebas de aislamiento
- [ ] Entradas nuevas validadas con Zod

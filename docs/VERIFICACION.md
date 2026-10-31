# Verificación final

Resultados de la verificación del 31 de octubre de 2026, con Node 24, Chrome de escritorio y Supabase local en Docker.

## Batería automática

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` / `lint` / `format:check` | Sin errores |
| `npm run test` | 205 pruebas en 19 archivos |
| `npm run build` | Correcto sin credenciales; 28 entradas en la precaché |
| `npm run test:db` | 132 pruebas pgTAP: 39 de `complete_day`, 67 de RLS y 26 de sincronización |
| `npm run test:integration` | 11 pruebas contra Auth y Storage reales |
| `npm run scan:secrets` | Sin hallazgos |
| `npm audit --omit=dev` | 0 vulnerabilidades en producción |

`npm audit --audit-level=high` no falla: quedan 23 avisos bajos y moderados en herramientas de desarrollo.

## Flujo en navegador real

Build de producción servida con las cabeceras de `vercel.json`, Chrome a 360×640 y Supabase local. `connect-src` e `img-src` se ampliaron solo para permitir el puerto local, y `Strict-Transport-Security` se omitió por ser HTTP. El script fue de un solo uso y no está en el repositorio.

Las 19 comprobaciones pasaron. No hubo violaciones de CSP: el único error de consola fue una petición fallida con la red cortada.

## Criterios de aceptación

| # | Criterio | Evidencia |
| --- | --- | --- |
| 1 | Typecheck, lint, test y build | Batería anterior |
| 2 | Usuario nuevo en día 1 con Fuerza A + Cardio 15 min | Registro real en Chrome y `RunnerPage.test.tsx` |
| 3 | Reabrir conserva paso y tiempos | Recarga real en la serie 2; prueba de restauración idéntica del estado |
| 4 | Día 31 → Día 32, Ciclo 2, rutina del día 1 | Chrome con Postgres (`global_day` = 32) y `RunnerPage.test.tsx` |
| 5 | Pesaje en 7/14/21/28 de todo ciclo, en kg | Días 7, 14, 21, 28, 38, 59 y 69 en pruebas; día 38 en Chrome guardó `80.50`, `cycle_day` 7, `cycle_number` 2 |
| 6 | `complete_day` idempotente y RLS | `complete_day.test.sql`, `rls.test.sql`, `sync.test.sql` |
| 7 | Instalable, abre offline y sincroniza | Chrome sin errores de instalabilidad; con la red cortada abrió, completó el día y añadió un alimento; al reconectar Postgres quedó con día 2, 18 series, cardio, sesión completada y 1 alimento |
| 8 | Español y usable a 360 px | Sin scroll horizontal en Hoy, serie, resumen, nutrición, peso y perfil; revisión visual de capturas |
| 9 | Historial, secretos y publicación | Sección siguiente |

## Lighthouse

Build de producción, emulación móvil y sesión iniciada.

| Pantalla | Performance | Accesibilidad |
| --- | --- | --- |
| Hoy | 100 | 100 |
| Nutrición | 100 | 100 |
| Historial de peso | 100 | 100 |
| Perfil | 100 | 100 |
| Iniciar sesión | 100 | 100 |

Lighthouse ya no incluye una categoría PWA: la instalabilidad se comprobó con `Page.getInstallabilityErrors` de Chrome, sin errores, y el manifest con `Page.getAppManifest`, sin errores. Son medidas en local: conviene repetirlas sobre el dominio de Vercel.

## Sin verificar

- Dispositivos reales: sonido, vibración, Wake Lock y el banner de instalación en Android, y la guía de iOS en un iPhone.
- El aviso "Actualizar", que necesita dos despliegues.
- Un proyecto real de Supabase Cloud y el despliegue en Vercel.
- Dos dispositivos reales a la vez: la fusión está cubierta por `sync.test.sql`, no por un uso real.

## Historial

Cada fase tiene uno o varios commits en formato Conventional Commits: las Fases 1 y 2 ya estaban divididas por tema cuando empezó este trabajo.

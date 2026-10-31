# Seguridad

Este documento recoge la configuración manual, que no se puede automatizar desde el repositorio, y el modelo de autorización. La evidencia de las pruebas está en [VERIFICACION.md](VERIFICACION.md).

## Checklist manual

### GitHub

El repositorio es **público** por decisión del propietario. Todo lo que llegue a GitHub, incluidas ramas, PRs e historial, debe considerarse publicado.

| Protección | En repositorio público | Quién la configura |
| --- | --- | --- |
| Secret scanning | Disponible sin coste | Propietario |
| Push protection | Disponible sin coste | Propietario |
| CodeQL | Disponible sin coste; el workflow ya sube las alertas a Security | Automático (`codeql.yml`) |
| Protección de rama | Disponible sin coste | Propietario |
| Dependabot alerts y security updates | Disponible sin coste | Propietario |
| Dependabot version updates | Activo al fusionar `dependabot.yml` | Automático |
| secretlint (pre-commit) y gitleaks (CI) | Activos | Automático |

- [ ] 2FA activado en la cuenta.
- [ ] Settings → Advanced Security: activar Dependabot alerts, Dependabot security updates, Secret scanning, Push protection y Private vulnerability reporting (lo usa `SECURITY.md`).
- [ ] Settings → Branches: proteger `main` exigiendo PR, una revisión y que pasen `verify`, `database`, `integration`, `secrets` y `analyze`, y bloqueando force-push y borrado. La regla debe incluir a los administradores para que aplique también al propietario; como único colaborador no podrás aprobar tu propia PR, así que exige la revisión solo si añades a otra persona.
- [ ] Settings → Actions → General: exigir aprobación para ejecutar workflows de colaboradores externos y dejar `GITHUB_TOKEN` en solo lectura por defecto.

### Supabase

- [ ] 2FA activado en la cuenta.
- [ ] Authentication → Providers → Email: confirmación de email activada.
- [ ] Authentication → Password: longitud mínima 10 y protección de contraseñas filtradas activada (requiere plan Pro).
- [ ] Authentication → Rate Limits: revisar los límites de intentos.
- [ ] Authentication → URL Configuration: Site URL de Vercel y Redirect URLs solo para `http://localhost:5173/restablecer` y `https://<dominio-de-vercel>/restablecer`, sin comodines.
- [ ] Authentication → Email Templates: traducir al español al menos "Confirm signup" y "Reset password", que por defecto están en inglés.
- [ ] Aplicar las migraciones con `supabase db push`.

### Vercel

- [ ] Definir `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Nunca la `service_role`.
- [ ] Comprobar en el dominio desplegado que las cabeceras de `vercel.json` llegan al navegador.

## Secretos

- `.env.local` no se versiona y solo contiene la URL y la clave anon, que son públicas por diseño. La protección real de los datos es RLS.
- La clave `service_role` no se usa en este proyecto: no debe estar en el repositorio, en CI ni en Vercel.
- `npm run test:secrets` comprueba que secretlint y gitleaks detectan un JWT con `"role":"service_role"`. El JWT se genera al ejecutarse, en un directorio temporal fuera del repositorio.

## Rotación de claves

1. Supabase → Project Settings → API: regenera la clave afectada.
2. Actualiza `.env.local` y las variables de Vercel, y vuelve a desplegar.
3. Si la clave llegó a Git, considera expuesto el valor aunque se elimine: tras rotarla, limpia el historial con autorización del propietario (`git filter-repo`) y revisa los accesos en los registros de Supabase.

## Modelo de autorización

- Toda tabla de `public` tiene RLS activado y forzado, con políticas basadas en `auth.uid()` y permisos concedidos por columna. `anon` no tiene acceso.
- La validación del cliente es solo UX: la autoridad son las restricciones, las políticas y `complete_day`.
- Funciones `security definer`, todas con `search_path = ''` y nombres calificados: `private.handle_new_user` (alta), `public.complete_day` (único camino para avanzar de día) y `public.delete_my_account` (borrado). Las dos últimas validan `auth.uid()` y solo las ejecuta `authenticated`.
- Las funciones `sync_*` de la cola offline son `security invoker`: RLS y los permisos por columna siguen aplicándose, y no pueden modificar un día cerrado ni escribir en uno futuro.
- Las pruebas de aislamiento están en `supabase/tests/` y se ejecutan en CI con `npm run test:db`.

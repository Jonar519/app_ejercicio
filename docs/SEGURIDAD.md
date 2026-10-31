# Seguridad

La auditoría final (sección 3.8) se añadirá en la Fase 6. Este documento recoge la configuración manual, que no se puede automatizar desde el repositorio.

## Checklist manual

### GitHub

- [ ] Repositorio **privado** (Settings → General → Danger Zone → Change visibility).
- [ ] 2FA activado en la cuenta.
- [ ] Dependabot alerts y Dependabot security updates activados.
- [ ] Secret scanning y Push protection activados.
- [ ] Rama `main` protegida: exigir PR, exigir revisión, exigir que pasen `verify`, `database` y `secrets`, bloquear force-push y borrado.

**Aviso sobre repositorios privados:** en cuentas gratuitas, Secret scanning, Push protection y la subida de resultados de CodeQL solo están disponibles en repositorios públicos o con GitHub Advanced Security. En privado, el workflow de CodeQL analiza pero no publica alertas, y la protección de secretos recae en secretlint y gitleaks. Las reglas de protección de rama en privado también pueden requerir un plan de pago; compruébalo en tu cuenta.

### Supabase

- [ ] 2FA activado en la cuenta.
- [ ] Authentication → Providers → Email: confirmación de email activada.
- [ ] Authentication → Password: longitud mínima 10 y protección de contraseñas filtradas activada (requiere plan Pro).
- [ ] Authentication → Rate Limits: revisar los límites de intentos.
- [ ] Authentication → URL Configuration: Site URL de Vercel y Redirect URLs solo para `http://localhost:5173` y el dominio real de Vercel, sin comodines.
- [ ] Aplicar las migraciones con `supabase db push`.

### Vercel

- [ ] Definir `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Nunca la `service_role`.
- [ ] Comprobar en el dominio desplegado que las cabeceras de `vercel.json` llegan al navegador.

## Secretos

- `.env.local` no se versiona y solo contiene la URL y la clave anon, que son públicas por diseño. La protección real de los datos es RLS.
- La clave `service_role` no se usa en este proyecto: no debe estar en el repositorio, en CI ni en Vercel.

## Rotación de claves

1. Supabase → Project Settings → API: regenera la clave afectada.
2. Actualiza `.env.local` y las variables de Vercel, y vuelve a desplegar.
3. Si la clave llegó a Git, considera expuesto el valor aunque se elimine: tras rotarla, limpia el historial con autorización del propietario (`git filter-repo`) y revisa los accesos en los registros de Supabase.

## Modelo de autorización

- Toda tabla de `public` tiene RLS activado y forzado, con políticas basadas en `auth.uid()` y permisos concedidos por columna. `anon` no tiene acceso.
- La validación del cliente es solo UX: la autoridad son las restricciones, las políticas y `complete_day`.
- Funciones `security definer`, todas con `search_path = ''` y nombres calificados: `private.handle_new_user` (alta), `public.complete_day` (único camino para avanzar de día) y `public.delete_my_account` (borrado). Las dos últimas validan `auth.uid()` y solo las ejecuta `authenticated`.
- Las pruebas de aislamiento están en `supabase/tests/` y se ejecutan en CI con `npm run test:db`.

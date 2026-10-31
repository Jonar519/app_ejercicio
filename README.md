# App Ejercicio

PWA mobile-first que guía un programa de entrenamiento de 31 días con contador continuo y registro de nutrición.

Stack: Vite, React 18, TypeScript, Tailwind CSS, Supabase. Pensada para desplegarse en Vercel.

## Requisitos

- Node ≥ 20.19 (la versión de referencia está en `.nvmrc`; regenerar `program.json` requiere Node 24)
- Docker, solo para `npm run test:db`
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), solo para aplicar migraciones

## Puesta en marcha

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Rellena `.env.local` con la URL y la clave **anon** de tu proyecto (Supabase → Project Settings → API). No uses nunca la clave `service_role` en una variable `VITE_*`: la app se niega a arrancar si detecta una clave secreta.

## Aplicar las migraciones en Supabase

```bash
supabase login
supabase link --project-ref <ref-del-proyecto>
supabase db push
```

Las migraciones están en `supabase/migrations/` y crean tablas, RLS, el trigger de alta, `complete_day`, las escrituras idempotentes de la cola offline, la exportación, el borrado de cuenta y el bucket `avatars`.

Si aún no tienes proyecto: créalo en [supabase.com](https://supabase.com), copia el *project ref* de la URL y sigue los comandos anteriores. Después aplica la configuración de `docs/SEGURIDAD.md`.

## Stack local de Supabase

```bash
npx -y supabase@2.122.0 start -x vector,imgproxy,postgres-meta,studio,edge-runtime,logflare,realtime
npm run test:integration
npx -y supabase@2.122.0 stop
```

Usa Docker y los puertos 453xx de `supabase/config.toml`; los correos de prueba se ven en `http://127.0.0.1:45324`.

## Desplegar en Vercel

1. Importa el repositorio en Vercel. Detecta Vite: comando `npm run build` y salida `dist`.
2. En Project Settings → Environment Variables define `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Nunca la clave `service_role`.
3. Despliega. `vercel.json` aporta el *rewrite* SPA, la CSP y las cabeceras de caché.
4. En Supabase → Authentication → URL Configuration, usa el dominio de Vercel como Site URL y añade `https://<dominio>/restablecer` a Redirect URLs.

### Checklist tras desplegar

- [ ] Registrarse y ver "Día 1" con Fuerza A + Cardio 15 min.
- [ ] Iniciar el entrenamiento, recargar y comprobar que continúa en el mismo paso.
- [ ] Activar el modo avión, completar una serie, volver a conectar y ver "Sincronizado".
- [ ] Instalar la app desde el banner en Android o con Compartir → Añadir a pantalla de inicio en iOS.
- [ ] Comprobar que un cambio desplegado muestra "Hay una nueva versión disponible".

## Uso sin conexión

La app abre sin red y permite completar un entrenamiento. Las series, los cierres de día, los pesos y los alimentos entran en una cola de IndexedDB y se envían en orden al reconectar, con escrituras idempotentes. Gana la última escritura por registro. El estado se ve en el indicador "Sin conexión / Sincronizando / Sincronizado".

Cerrar sesión borra los datos del dispositivo, incluida la cola: la app avisa si quedan registros sin enviar.

## Scripts

| Script | Acción |
| --- | --- |
| `npm run dev` / `build` / `preview` | Desarrollo, build de producción y previsualización |
| `npm run typecheck` / `lint` / `format` | Tipos, ESLint y Prettier |
| `npm run test` | Pruebas unitarias con Vitest |
| `npm run test:db` | Aplica las migraciones en un Postgres desechable y ejecuta las pruebas pgTAP |
| `npm run test:integration` | Prueba Auth y Storage reales contra el stack local |
| `npm run scan:secrets` | Busca secretos en los archivos del repositorio |
| `npm run test:secrets` | Comprueba con un JWT sintético que secretlint y gitleaks detectan claves `service_role` (requiere Docker) |
| `npm run program:json` | Regenera `src/data/program.json` desde `program.ts` |
| `npm run icons` | Regenera `public/icons` |

## Documentación

- [Decisiones](docs/DECISIONES.md)
- [Seguridad y checklist manual](docs/SEGURIDAD.md)
- [Verificación final](docs/VERIFICACION.md)
- [Política de vulnerabilidades](SECURITY.md)

## Licencia

[MIT](LICENSE)

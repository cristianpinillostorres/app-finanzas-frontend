# App de finanzas personales — versión pública

Versión pública (multiusuario) de la app de finanzas. Angular (zoneless,
standalone) + Supabase (Auth + Postgres con RLS) + Cloudflare Pages — sin
backend propio, ver "Arquitectura" abajo. Las pantallas son las mismas de
la versión personal (`../../frontend`, que sigue en Firebase); aquí solo
cambian el almacenamiento y el login.

Especificación funcional/técnica: `../../notas-app-finanzas.md` y
`../../notas-tecnicas-app-finanzas.md`. Decisiones de la versión personal:
`PROGRESS.md`. El esquema de la base vive en otro repositorio:
`../supabase`.

## Arquitectura

No hay backend propio. El cliente Angular habla directo con Supabase:

- **Supabase Auth**: anónimo ("Regístrate" recorre la bienvenida sin
  cuenta), correo/contraseña y Google. Al final de la bienvenida la sesión
  anónima se convierte en cuenta con el mismo uid (`AuthService`).
- **Postgres** con una tabla por recurso (`cuentas`, `creditos`,
  `extractos`, `cambios_tasa`, `compras`, `movimientos`, `pagos_fijos`,
  `categorias`, `preferencias`). Cada fila lleva `user_id` y **RLS** solo
  deja leerla y escribirla a ese usuario. La clave publicable de
  `environment*.ts` no es secreta; la `service_role` nunca va aquí.
- **Offline-first** (`core/sync/`): `SesionLocal` guarda una copia de los
  datos en IndexedDB y una cola de escrituras. Las pantallas leen la
  copia (abren al instante, aun sin señal), cada escritura se aplica ahí
  en el acto y la cola se sube en orden cuando hay red. Los cambios de
  otros dispositivos llegan en vivo (Supabase Realtime) y al volver a la
  app.
- **Cloudflare Pages** sirve el build estático (`public/_redirects` para
  las rutas de Angular, `public/_headers` para que una versión nueva
  llegue en la siguiente apertura).
- **PWA** (`@angular/service-worker`, `ngsw-config.json`,
  `public/manifest.webmanifest`).

Cada recurso se accede por una interfaz (`core/api/*/*-api.ts` +
`InjectionToken`), nunca directo desde las pantallas; la implementación
es `*SupabaseApi` (registradas en `core/api/api.providers.ts`). Todo el
cálculo (saldos, deuda, semáforo, resúmenes) vive en `core/domain`, sin
Angular ni Supabase — puro, con pruebas.

## Requisitos

- Node.js 22 + npm.
- El proyecto de Supabase creado y las migraciones de `../supabase`
  aplicadas; su URL y clave publicable en `src/environments/`.

## Cómo correr

```bash
npm install
npm start        # ng serve — http://localhost:4200
```

`ng serve` habla con el Supabase real: no hay datos de prueba. Para
probar como alguien nuevo, usa "Regístrate" en el login.

## Pruebas y build

```bash
npm test          # Vitest
npm run build     # build de producción (usa environment.prod.ts)
```

## Desplegar

Lo hace GitHub Actions (`.github/workflows/desplegar.yml`) en cada push:
pruebas → build → `wrangler pages deploy`.

- `main` → producción (`app-finanzas-8ba.pages.dev`).
- Cualquier otra rama → URL de vista previa propia.
- Secretos del repositorio: `CLOUDFLARE_API_TOKEN` (permiso *Cloudflare
  Pages: Edit*) y `CLOUDFLARE_ACCOUNT_ID`.

**Hotfix**: rama `hotfix/x` desde `main` → push → se prueba en su URL de
vista previa → PR → merge a `main` → producción en 2–3 minutos. La PWA
toma la versión nueva al abrirse (`app.ts` recarga con `VERSION_READY`).

**Revertir**: Cloudflare → Workers & Pages → app-finanzas → Deployments →
*Rollback* en el despliegue anterior. Es instantáneo.

**Desde el PC, sin GitHub**: `npx wrangler login` una vez, y luego
`npm run deploy`.

## PWA / instalar en el celular

- **Android/Chrome**: lee `public/manifest.webmanifest` directo — ofrece
  instalar sola.
- **iOS/Safari no lee el manifest para esto** (aunque sí existe y trae
  `display: standalone`): usa sus propias meta tags en `index.html`
  (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`,
  `apple-touch-icon`). Para instalar: Safari → compartir → "Agregar a
  pantalla de inicio". iOS a veces guarda la configuración del ícono al
  momento de agregarlo — si cambia algo de esto después, quítalo y
  agrégalo de nuevo para que tome los cambios.
- **Íconos** (`public/icons/`): diseño propio simple ("$" sobre fondo
  `#185fa5`, círculo blanco centrado dentro del "safe zone" para que no
  se corte al enmascarar en Android). Fuente editable en
  `scripts/icon-source.svg`; para regenerar los 8 PNG tras cambiarlo:
  `npm install --no-save sharp && node scripts/generar-iconos.mjs && npm uninstall sharp`.
  Si más adelante hay un logo real de marca, es el mismo flujo: cambiar
  el SVG y regenerar.
- **Caché**: el service worker (`ngsw-config.json`) cachea el app shell
  para que cargue offline después de la primera visita. Efecto
  secundario esperado, no un bug: tras cada deploy, quien ya tenía la
  app instalada puede tardar en ver la versión nueva (el service worker
  la descarga en segundo plano y la aplica en el siguiente arranque, no
  al instante).
- **Por qué el JavaScript va en el grupo `js` con `installMode: lazy`**:
  el builder `application` emite también los chunks perezosos en la raíz,
  así que el `/*.js` en `prefetch` que traía la plantilla descargaba en la
  instalación _todo_ lo que la app pudiera llegar a necesitar — incluidos
  los ~1.9 MB de ApexCharts, que solo hacen falta si se abre General, y su
  bundle de SSR, que acá (solo cliente) no se usa nunca. En `lazy` con
  `updateMode: prefetch`, cada chunk se cachea la primera vez que el
  navegador lo pide y desde ahí se actualiza solo: el shell sigue
  disponible sin conexión (su JS se pide en la primera carga) sin pagar
  por adelantado las rutas que todavía no se visitaron. JSON no admite
  comentarios, por eso la explicación vive acá.

## Estructura

- `core/models/` — tipos del dominio (`Cuenta`, `Movimiento`, `Credito`...).
- `core/domain/` — toda la lógica de negocio, pura, con pruebas
  (`core/domain/*.spec.ts`).
- `core/api/` — una interfaz + `InjectionToken` por recurso, con su
  implementación sobre `core/sync`.
- `core/auth/` — sesión (`AuthService`, sobre Supabase Auth).
- `core/supabase/` — el cliente de Supabase (`SUPABASE_PROVIDERS`).
- `core/sync/` — copia local, cola de escrituras y sincronización
  (`SesionLocal`), y el mapeo fila ↔ dominio (`tablas.ts`).
- `features/` — una carpeta por pantalla (Cuentas, Créditos, Movimientos,
  Pagos fijos, General) más `login/`.
- `layout/` — el shell (navegación, barra superior/inferior).
- `shared/` — componentes y pipes reutilizados entre pantallas.
- `styles/` — sistema de diseño (tokens en 3 capas + clases de
  componentes), portado del prototipo en `../app-finanzas.prototipo/`.

# Seguimiento — App de finanzas

Estado actual de la app. Se actualiza cuando cambia algo relevante o hay una
decisión que no está en `README.md`, `PRODUCT.md` ni `DESIGN.md`.

## Qué es

PWA instalable (iOS y Android), celular primero. Angular (zoneless,
standalone) + Supabase (Auth + Postgres con RLS) + Cloudflare Pages, sin
backend propio. Cada persona tiene su cuenta y sus datos.

## Qué tiene

| Área | Contenido |
| --- | --- |
| Acceso | Correo y contraseña, Google, "Regístrate" (bienvenida sin cuenta) y recuperar contraseña por correo |
| General | Cuánto queda libre del mes, qué pagar y cuándo, en qué se va la plata |
| Cuentas | Cuentas y bolsillos, ajuste de saldo |
| Créditos | Tarjetas, bancos, plataformas y personas; extractos, cambios de tasa y compras a cuotas |
| Pagos fijos | Mensuales, bimestrales y anuales, con cuenta por defecto |
| Movimientos | Gastos, ingresos, transferencias y ajustes; buscador y filtros |
| Categorías | Catálogo base más lo que cada persona personaliza |
| Preferencias | Tema claro/oscuro, ocultar montos, objetivos y nombre |
| Sin conexión | Los datos viven primero en el dispositivo y se suben solos al volver la señal |

El cálculo de saldos y deudas vive en `core/domain`, puro y con pruebas. Los
datos están en 9 tablas de Supabase (`publica/supabase`), todas con RLS por
`user_id`.

## Pendiente

- Activar Google en Supabase (cliente OAuth de Google Cloud) para que "Continuar
  con Google" funcione.
- SMTP propio (Brevo) para los correos de recuperación y confirmación.
- Revisar a mano en celular real: bienvenida, tema oscuro y cuotas de crédito.

## Cómo correr

Ver `README.md` para arquitectura, requisitos y despliegue. Resumen:

- `npm start` — `ng serve`, contra el proyecto real de Supabase. Para probar
  como alguien nuevo se usa "Regístrate".
- `npm test` — pruebas unitarias (Vitest).
- `npm run build` — build de producción.
- `npm run deploy` — build + `wrangler pages deploy`.

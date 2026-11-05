# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

PWA instalable (iOS y Android) sobre Angular + Supabase. Celular primero: la
mayoría la usará instalada en el teléfono; el escritorio es secundario.

## Users

Público general en Colombia que quiere ordenar sus finanzas personales, sin
conocimiento financiero previo. Hoy la usa una sola persona (el autor), pero
la intención confirmada es **distribuirla**: cada decisión de producto debe
funcionar para alguien que abre la app por primera vez, no solo para quien la
construyó.

Situación típica: acaba de pagar algo y lo registra desde el celular en
segundos; en otros momentos abre la app para saber cómo va el mes.

## Product Purpose

Registro 100% manual de cuentas, bolsillos, movimientos, créditos y pagos
fijos, para que la persona tenga control de su plata sin conectar bancos.

Cada vez que se abre, la app tiene que responder estas cuatro preguntas, con
el mismo peso:

1. ¿Cuánto me queda libre este mes? (después de pagos fijos y cuotas)
2. ¿Qué tengo que pagar y cuándo? (que no se pase ningún pago ni cuota)
3. ¿Cómo voy con mis deudas? (bancos, tarjetas, plataformas, personas)
4. ¿En qué se me va la plata? (gasto por categoría y tendencia del mes)

Éxito: la persona confía en los números y no tiene que hacer cuentas mentales.

## Positioning

Modela las deudas como las vive un colombiano, no como un presupuesto
genérico: tarjetas de crédito con compras a cuotas y extractos, plataformas
de crédito tipo Addi o Sistecrédito, créditos de banco con tabla de
amortización y tasa variable (con su historial de cambios de tasa), y deudas
informales con personas. Distingue cuentas de bolsillos (reservados o no) y
calcula "lo libre del mes" restando lo que ya está comprometido.

## Operating Context

- Registro inmediato desde el celular, muchas veces en la calle justo después
  de pagar.
- Revisión del mes (cuánto queda, qué falta pagar) en el mismo celular; el
  escritorio sirve para revisar con calma.
- Montos en pesos colombianos (COP), formato local, cifras que pueden llegar a
  12 dígitos.
- Conectividad variable: la PWA cachea el shell para abrir sin red.

## Capabilities and Constraints

- **Cuentas** de tipo banco, billetera, efectivo u otro, con **bolsillos**
  dentro (reservados o no). El saldo de una cuenta es saldo libre + bolsillos,
  nunca se edita a mano; se corrige con un ajuste.
- **Movimientos:** ingreso, gasto, transferencia (entre cuentas o hacia un
  crédito), interno (cuenta ↔ su bolsillo) y ajuste. Solo ingresos y gastos
  cuentan en los indicadores del mes.
- **Créditos** en cuatro grupos: tarjeta (cupo, corte, compras a cuotas),
  plataforma (cupo, compras a cuotas), banco (monto, tasa EA fija o variable,
  plazo, seguro) y persona (monto, abonos, fecha acordada opcional).
- **Pagos fijos** mensuales, bimestrales o anuales, de monto fijo o estimado,
  con semáforo de vencimiento (verde ≥5 días, amarillo 2–4, rojo ≤1 o vencido).
  Las cuotas de créditos no se guardan como pago fijo: se derivan.
- **Categorías:** catálogo fijo en código, sin edición desde la app.
- **Ocultar montos** con un botón, y tema claro/oscuro manual.
- Todo el cálculo vive en `core/domain`, puro y con pruebas.
- **Decisiones abiertas para distribuir** (no inventar respuestas):
  - No hay primer uso / onboarding ("Configura tu mes" quedó fuera de alcance).
  - No hay pantallas de Ajustes, Categorías editables ni Exportar datos.
  - Modelo de negocio, precio y canal de distribución: sin definir.

## Brand Commitments

- **Español de Colombia, tuteo.** La voz actual se mantiene: "Te queda libre
  este mes", "Dónde está tu dinero", "Pago de Arriendo registrado".
- **Registrar en segundos.** El flujo del botón + (gasto, ingreso,
  transferencia) es intocable: cualquier cambio que lo alargue es una regresión.
- Nombre de producto y logo: no hay. El ícono actual ("$" sobre `#185fa5`) es
  provisional.

## Evidence on Hand

- Datos de ejemplo realistas en `src/app/core/api/mock-data.ts`
  (`useMock: true`).
- Registro de decisiones y verificaciones en `PROGRESS.md`.
- No hay testimonios, usuarios externos, métricas de uso ni prensa. No
  fabricarlos.

## Product Principles

1. **Primero lo que se hace a diario.** Registrar un movimiento y ver cuánto
   queda pesan más que cualquier análisis.
2. **Nada de cuentas mentales.** Si dos cifras importan por su relación, la
   app muestra la relación (total, proporción, diferencia), no dos números
   sueltos.
3. **Exactitud antes que adorno.** Un número que no cuadra entre pantallas
   rompe la confianza; ningún dato se muestra si no se puede calcular con lo
   que hay.
4. **Entendible sin saber de finanzas.** Quien abre la app por primera vez
   debe entender qué significa cada cifra y qué hacer después, en lenguaje
   cotidiano.
5. **Celular primero.** Cada pantalla se piensa a 360–390px con el pulgar; el
   escritorio aprovecha el espacio extra sin cambiar la lógica.

## Accessibility & Inclusion

Contraste WCAG AA en los dos temas, verificado con
`npm run verificar:contraste`. Área táctil mínima de 44px.
`prefers-reduced-motion` respetado en CSS y en JS. Montos con `clamp()` para
no desbordar a 360px.

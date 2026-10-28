---
version: alpha
name: Finanzas
description: App de finanzas personales para Colombia, celular primero. Comparte el sistema visual de Mi Semana, la otra app de la casa, con los números como protagonistas.
colors:
  primary: '#22545b'
  on-primary: '#ffffff'
  primary-container: '#ddf1f2'
  primary-glow: '#2e7f85'
  page: '#f6f8f9'
  surface: '#ffffff'
  surface-subtle: '#e3e8ea'
  on-surface: '#0e1414'
  on-surface-variant: '#3e4a4e'
  muted: '#5b686c'
  outline: '#cbd5d8'
  outline-control: '#7f8c90'
  ingreso: '#2f6e35'
  gasto: '#b42318'
  deuda: '#7f5d0f'
  marca: '#17383b'
  primary-dark: '#7fd0d5'
  on-primary-dark: '#0b1213'
  primary-container-dark: '#17383b'
  primary-glow-dark: '#4fb3b8'
  page-dark: '#0b1213'
  surface-dark: '#121b1d'
  surface-raised-dark: '#1a2528'
  surface-subtle-dark: '#2b3a3d'
  on-surface-dark: '#eaf2f2'
  on-surface-variant-dark: '#bccbcd'
  muted-dark: '#9db0b3'
  outline-dark: '#2b3a3d'
  outline-control-dark: '#637377'
  ingreso-dark: '#7bc276'
  gasto-dark: '#f28b82'
  deuda-dark: '#e6b84e'
typography:
  display-lg:
    fontFamily: Anton
    fontSize: 44px
    fontWeight: 400
    lineHeight: 0.92
    letterSpacing: 0.01em
  display:
    fontFamily: Anton
    fontSize: 28px
    fontWeight: 400
    lineHeight: 0.92
    letterSpacing: 0.01em
  amount-hero:
    fontFamily: Plus Jakarta Sans
    fontSize: 44px
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: -0.02em
    fontFeature: '"tnum"'
  amount-kpi:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: -0.01em
    fontFeature: '"tnum"'
  label-caps:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: 800
    lineHeight: 1.35
    letterSpacing: 0.06em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.5
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.5
  amount-row:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.35
    fontFeature: '"tnum"'
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.35
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.35
  icon:
    fontFamily: Material Symbols Outlined
    fontSize: 20px
    fontWeight: 400
    lineHeight: 1
rounded:
  xs: 6px
  sm: 8px
  md: 12px
  chip: 16px
  lg: 20px
  xl: 28px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  tap-min: 44px
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-primary}'
    typography: '{typography.label-md}'
    rounded: '{rounded.full}'
    height: 44px
    padding: 16px
  button-primary-dark:
    backgroundColor: '{colors.primary-dark}'
    textColor: '{colors.on-primary-dark}'
    typography: '{typography.label-md}'
    rounded: '{rounded.full}'
    height: 44px
    padding: 16px
  nav-item-selected:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-primary}'
    typography: '{typography.label-md}'
    rounded: '{rounded.chip}'
    height: 44px
  nav-item-selected-dark:
    backgroundColor: '{colors.primary-dark}'
    textColor: '{colors.on-primary-dark}'
    typography: '{typography.label-md}'
    rounded: '{rounded.chip}'
    height: 44px
  chip-selected:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-primary}'
    typography: '{typography.label-md}'
    rounded: '{rounded.full}'
    height: 36px
  chip-selected-dark:
    backgroundColor: '{colors.primary-dark}'
    textColor: '{colors.on-primary-dark}'
    typography: '{typography.label-md}'
    rounded: '{rounded.full}'
    height: 36px
  page-head:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.primary}'
    typography: '{typography.display}'
    rounded: '{rounded.lg}'
    padding: 16px
  page-head-dark:
    backgroundColor: '{colors.surface-dark}'
    textColor: '{colors.primary-dark}'
    typography: '{typography.display}'
    rounded: '{rounded.lg}'
    padding: 16px
  sidebar:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.on-surface}'
    typography: '{typography.label-md}'
    rounded: '{rounded.xl}'
    padding: 16px
    width: 220px
  sidebar-dark:
    backgroundColor: '{colors.surface-dark}'
    textColor: '{colors.on-surface-dark}'
    typography: '{typography.label-md}'
    rounded: '{rounded.xl}'
    padding: 16px
    width: 220px
  hero:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.on-surface}'
    typography: '{typography.amount-hero}'
    rounded: '{rounded.lg}'
    padding: 20px
  hero-dark:
    backgroundColor: '{colors.surface-dark}'
    textColor: '{colors.on-surface-dark}'
    typography: '{typography.amount-hero}'
    rounded: '{rounded.lg}'
    padding: 20px
  panel:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.on-surface-variant}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.lg}'
    padding: 16px
  panel-dark:
    backgroundColor: '{colors.surface-dark}'
    textColor: '{colors.on-surface-variant-dark}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.lg}'
    padding: 16px
  stat-card:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.muted}'
    typography: '{typography.amount-kpi}'
    rounded: '{rounded.lg}'
    padding: 16px
  stat-card-dark:
    backgroundColor: '{colors.surface-dark}'
    textColor: '{colors.muted-dark}'
    typography: '{typography.amount-kpi}'
    rounded: '{rounded.lg}'
    padding: 16px
  dialog:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.primary}'
    typography: '{typography.display}'
    rounded: '{rounded.xl}'
    padding: 24px
  dialog-dark:
    backgroundColor: '{colors.surface-raised-dark}'
    textColor: '{colors.primary-dark}'
    typography: '{typography.display}'
    rounded: '{rounded.xl}'
    padding: 24px
  page:
    backgroundColor: '{colors.page}'
    textColor: '{colors.on-surface}'
  page-dark:
    backgroundColor: '{colors.page-dark}'
    textColor: '{colors.on-surface-dark}'
  input:
    backgroundColor: '{colors.page}'
    textColor: '{colors.on-surface}'
    typography: '{typography.body-md}'
    rounded: '{rounded.md}'
    height: 44px
  input-dark:
    backgroundColor: '{colors.page-dark}'
    textColor: '{colors.on-surface-dark}'
    typography: '{typography.body-md}'
    rounded: '{rounded.md}'
    height: 44px
  login-marca:
    backgroundColor: '{colors.marca}'
    textColor: '{colors.on-surface-dark}'
    typography: '{typography.body-md}'
  skeleton:
    backgroundColor: '{colors.surface-subtle}'
    rounded: '{rounded.xs}'
  skeleton-dark:
    backgroundColor: '{colors.surface-subtle-dark}'
    rounded: '{rounded.xs}'
  monto-ingreso:
    textColor: '{colors.ingreso}'
    typography: '{typography.amount-row}'
  monto-gasto:
    textColor: '{colors.gasto}'
    typography: '{typography.amount-row}'
  monto-deuda:
    textColor: '{colors.deuda}'
    typography: '{typography.amount-row}'
  monto-ingreso-dark:
    textColor: '{colors.ingreso-dark}'
    typography: '{typography.amount-row}'
  monto-gasto-dark:
    textColor: '{colors.gasto-dark}'
    typography: '{typography.amount-row}'
  monto-deuda-dark:
    textColor: '{colors.deuda-dark}'
    typography: '{typography.amount-row}'
  borde-control:
    backgroundColor: '{colors.outline-control}'
  borde-control-dark:
    backgroundColor: '{colors.outline-control-dark}'
  borde-decorativo:
    backgroundColor: '{colors.outline}'
  borde-decorativo-dark:
    backgroundColor: '{colors.outline-dark}'
---

# Finanzas

Este archivo sigue el formato DESIGN.md de Google Labs (versión alpha). Los
valores de arriba son los mismos de `src/styles/tokens/`; si cambian allá,
cambian acá. Los nombres terminados en `-dark` son el tema oscuro.

## Overview

Una app para que cualquier persona en Colombia sepa cuánto le queda libre
este mes, qué tiene que pagar y cuánto debe, sin saber de finanzas. Se usa
casi siempre en el celular, muchas veces en la calle, justo después de
pagar algo.

Es de la misma casa que Mi Semana (`app-mi-semana/mi_semana-front`) y se ve
igual: la misma paleta teal con grises fríos, las mismas dos fuentes, los
mismos radios grandes, botones en píldora con un halo teal y el mismo
esquema de pantalla en escritorio (marca en Anton arriba, barra lateral
flotante a la izquierda). Lo único propio de Finanzas es la textura de
billete de la tarjeta principal y los colores de monto. Si algo cambia en
el sistema de Mi Semana, se trae acá con el mismo valor.

Mientras llegan los datos, cada pantalla muestra esqueletos con la forma de
lo que viene, nunca un "$0" ni un "Todavía no tienes cuentas" que parezcan
reales.

## Colors

Grises fríos con un tinte verde azulado y un solo color de marca, el teal.
Los colores de monto tienen significado fijo: verde es ingreso, rojo es
gasto y ámbar es deuda o vencimiento. Ninguno se usa para decorar.

- `primary` (claro `#22545b`, oscuro `#7fd0d5`) es el teal de la casa:
  enlaces, títulos en Anton, botón principal, sección activa, chip
  seleccionado y la textura de billete. Lo seleccionado va relleno de
  teal con el texto en blanco (en oscuro, casi negro).
- `primary-glow` (`#2e7f85` / `#4fb3b8`) es el teal de los bordes al pasar
  por encima, del anillo de foco y del halo de la acción principal. No se
  usa como texto.
- En el tema oscuro el texto sobre el teal es casi negro (`#0b1213`), no
  blanco: blanco sobre un teal claro no llega a contraste AA.
- Mi Semana dibuja todos sus bordes con el mismo gris claro. Acá eso vale
  para tarjetas, botones y chips, que se reconocen por su texto. Los campos
  de texto usan `outline-control`, que llega a 3:1, porque su borde es la
  única señal de que ahí se escribe.
- Todos los pares de texto y fondo cumplen WCAG AA en los dos temas.
  `npm run verificar:contraste` lo comprueba leyendo los tokens reales y
  falla si alguien rompe un par.

## Typography

Las dos familias de Mi Semana, servidas desde `public/fonts` para que la
app instalada las tenga sin conexión.

- **Plus Jakarta Sans** (variable, 400 a 800) para todo el texto. El peso
  base es 500, como en Mi Semana: a 400 se ve delgada sobre estos grises.
- **Anton** solo para la marca del cabezote ("FINANZAS", 44px), el título
  de cada pantalla y el de cada diálogo (28px), siempre en mayúsculas.
  Fuera de esos tres sitios no aparece.
- Las cifras van en 800 con cifras tabulares, para que las columnas queden
  alineadas dígito a dígito. La principal de cada pantalla llega a 44px,
  con el "$" a poco más de la mitad, alzado y algo más tenue. La de cada
  indicador llega a 28px y se achica con el ancho de su tarjeta.
- Los rótulos de indicador y los encabezados de panel van en mayúsculas,
  12px, peso 800 y un poco de aire entre letras ("DEUDA TOTAL", "PAGOS DEL
  MES"). Solo rótulos de una a cuatro palabras: una frase entera en
  mayúsculas se lee a golpes.
- Los íconos son Material Symbols Outlined.
- En el resto, mayúscula inicial solamente ("Agregar cuenta", no "Agregar
  Cuenta").

## Layout

Celular primero, pensado a 360 y 390px con el pulgar. Espaciado en pasos
de 4px.

- En escritorio: la marca en Anton arriba a la izquierda y las acciones a
  la derecha, sobre el color de la página. Debajo, la barra lateral (220px)
  con las cinco secciones y el contenido al lado, todo hasta 1440px. Entre
  768 y 1023px la barra lateral se queda en íconos.
- En el celular: header con el sello y el nombre de la pantalla en Anton,
  barra inferior con las cinco secciones y el botón flotante de nuevo
  movimiento.
- El contenido usa una grilla de 12 columnas desde 768px.
- La cifra principal va arriba y a la izquierda, con su explicación debajo
  en una frase. Los montos se alinean a la derecha en las filas.
- Ningún control táctil baja de 44px.

## Elevation & Depth

Los paneles no tienen sombra: se separan de la página por su tono y un
borde. La sombra queda para lo que flota o se toca como un objeto: la
barra lateral y los menús (sombra larga), las tarjetas de crédito (sombra
corta, y al pasar por encima suben 2px con un aro teal). La acción
principal lleva un halo teal (`--glow-md`), la firma de las dos apps. Los
campos de texto van hundidos, con el color de la página como relleno.

## Shapes

Las esquinas de Mi Semana: 6px en esqueletos, 12px en campos y sellos de
ícono, 16px en los ítems de la barra lateral, 20px en tarjetas y paneles,
y 28px en la barra lateral, diálogos y hojas inferiores. Botones, chips y
el selector de mes son píldoras.

## Components

- **Cabecera de pantalla** (`app-page-head`): un panel con el sello de la
  sección (su ícono de la barra lateral, en blanco sobre teal) y el título
  en Anton y teal. Es la cabecera de categoría de Mi Semana. Solo en
  escritorio; en el celular el header ya dice dónde estás.
- **Barra lateral**: panel flotante con el rótulo "SECCIONES" y las cinco
  secciones; la activa va rellena de teal.
- **Tarjeta héroe** (`.hero`): una por pantalla, con la cifra que responde
  la pregunta de esa pantalla. Lleva la textura de billete: líneas finas
  entrelazadas, como la impresión de seguridad de un billete, dibujadas en
  `public/textura-billete.svg` y aplicadas como máscara para que tomen el
  color del acento. Se desvanecen hacia la izquierda, donde va el texto.
- **Indicadores** (`app-stat-card`): rótulo en mayúsculas y cifra en 800,
  como las métricas del tablero de Mi Semana.
- **Diálogos**: 28px de esquina, título en Anton y teal, campos hundidos.
- **Esqueletos** (`.skeleton`, `app-skeleton-rows`, `<app-amount [cargando]>`):
  bloques en `surface-subtle` con un brillo lento que se apaga con
  `prefers-reduced-motion`. Tienen el tamaño de lo que reemplazan y la
  pantalla se marca con `aria-busy` mientras tanto. `primeraCarga()` decide
  cuándo terminan.
- **Login**: conserva su propio diseño (panel de marca a la izquierda,
  tarjeta de acceso a la derecha, botones y campos de 8px) y toma solo los
  colores de la casa: el panel de marca va en teal profundo (`marca`, igual
  en los dos temas, la única superficie de color de la app) y la línea de
  la tarjeta y el botón "Entrar" en el teal principal.
- **Botón principal**: píldora rellena de teal con halo, uno por vista. El
  resto va con borde gris claro (al pasar por encima se vuelve teal) o
  como texto.
- **Estados vacíos**: dicen qué falta y ofrecen la acción para empezar. No
  aparecen hasta que los datos llegaron.

## Do's and Don'ts

- Sí: copiar de Mi Semana cualquier valor visual nuevo en vez de inventar
  uno parecido. Las dos apps tienen que poder abrirse lado a lado.
- Sí: mostrar la relación entre dos cifras (total, proporción, diferencia)
  en vez de dos números sueltos.
- Sí: textos cortos en español de Colombia, con tuteo y verbos simples.
  "Agrega tu banco", "Registrar pago", "Google quedó vinculado a tu cuenta".
- Sí: movimiento solo como respuesta a algo que hizo la persona, con
  transform y opacidad, entre 150 y 250ms.
- No: Anton en texto corrido, en cifras o en botones.
- No: el halo teal en botones que se repiten en una lista (por eso
  `.btn-compacto` no lo lleva).
- No: rayas largas en los textos de la interfaz, "¡Listo!" de relleno ni
  palabras infladas.
- No: más adornos que la textura de billete y el halo; nada de degradados
  ni vidrio esmerilado como fondo de contenido.
- No: un spinner o un hueco en blanco donde puede ir un esqueleto.

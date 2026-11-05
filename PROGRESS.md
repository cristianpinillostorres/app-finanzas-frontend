# Seguimiento — App de finanzas personales (frontend)

Registro de avance por fases. Se actualiza al terminar cada fase o cuando hay
una decisión relevante que no está en las notas.

Fuente de verdad funcional/técnica: `../notas-app-finanzas.md` y
`../notas-tecnicas-app-finanzas.md` (un nivel arriba de `frontend/`, no en
`docs/`).

## Estado por fase

| Fase                        | Contenido                                                                        | Estado   |
| --------------------------- | -------------------------------------------------------------------------------- | -------- |
| 1. Base                     | Proyecto, locale, modelos, interfaces y mocks de API, dominio con pruebas        | ✅ Hecha |
| 2. Layout                   | Shell, navegación responsive, botón de nuevo movimiento (sin formulario)         | ✅ Hecha |
| — Sistema de diseño         | Tokens (3 capas) + integración con Material a partir del prototipo del diseñador | ✅ Hecha |
| 3. Formulario de movimiento | Gasto, ingreso, transferencia                                                    | ✅ Hecha |
| 4. Cuentas                  | Pantalla completa                                                                | ✅ Hecha |
| 5. Créditos                 | Pantalla completa                                                                | ✅ Hecha |
| 6. Pagos fijos              | Pantalla completa                                                                | ✅ Hecha |
| 7. Movimientos              | Pantalla completa                                                                | ✅ Hecha |
| 8. General                  | Pantalla completa                                                                | ✅ Hecha |

Las 8 fases del plan original están completas. Después vinieron dos tandas
más grandes, cada una con su sección abajo: **"Migración a Firebase"** (del
20 al 22 de septiembre, el backend) y **"Rediseño de UI"** (22 y 23 de
septiembre, lo visual); los pendientes que quedan abiertos están al final
de la sección del rediseño. La tanda del 15 y 16 de octubre (**"Pasada de
impeccable"**, abajo) está en `main` desde el 2026-10-15, encima de la
corrección de cuotas de crédito del 12 de octubre. Lo desplegado está al día
con `main` desde el 2026-10-15. Después vino **"Login con Google y registro
abierto"** (abajo), que no está desplegado: antes hay que hacer dos pasos en
la consola, listados en esa sección. Encima va **"Toque elegante"** (también
sin desplegar): tipografía, acento, textura de billete y esqueletos de carga.
Y encima, sin commit todavía, el login nuevo y el **"Tema de Mi Semana"**: la
app toma la paleta, las fuentes y el esquema de pantalla de Mi Semana.

## Migración a Firebase (2026-09-20)

**Decisión:** se descartó un backend propio (Spring Boot, llegó a tener 3
fases hechas — base, dominio, seguridad — antes de descubrirse que no había
dónde desplegarlo). Sin backend propio, los datos y la seguridad los da
Firebase directo desde el cliente: **Cloud Firestore** + **Firebase
Authentication** + **Firestore Security Rules**, servido con **Firebase
Hosting**. Detalle completo de la decisión y de qué cambia técnicamente
(dinero como enteros en vez de `BigDecimal`, reglas de negocio que ya no
tienen backend que las valide, etc.) quedó en la conversación que originó
este cambio.

La arquitectura por puertos (`*Api` + `InjectionToken`, ver
`core/api/api.providers.ts`) es la que permite este pivote sin tocar
dominio, páginas ni formularios: cada recurso solo necesita una
implementación `*FirestoreApi` nueva detrás de la misma interfaz.

| Fase                   | Contenido                                                           | Estado                                      |
| ---------------------- | ------------------------------------------------------------------- | ------------------------------------------- |
| 1. Setup Firebase      | SDK, providers, catálogo estático de categorías, Hosting            | ✅ Hecha                                    |
| 2. Autenticación       | Firebase Auth (un usuario), pantalla de login                       | ✅ Hecha                                    |
| 3. Reglas de seguridad | `firestore.rules` (`/usuarios/{uid}/**`)                            | ✅ Hecha y desplegada                       |
| 4. Cuentas y bolsillos | `CuentasFirestoreApi`                                               | ✅ Hecha (falta probar en vivo — ver abajo) |
| 5. Movimientos         | `MovimientosFirestoreApi`                                           | ✅ Hecha (falta probar en vivo)             |
| 6. Créditos            | `CreditosFirestoreApi`, `ComprasFirestoreApi`                       | ✅ Hecha (falta probar en vivo)             |
| 7. Pagos fijos         | `PagosFijosFirestoreApi`                                            | ✅ Hecha                                    |
| 8. Integración final   | `apiUrl` retirado, `useMock:false` por defecto, deploy real, README | ✅ Hecha                                    |

### Fase 1 — Setup Firebase (2026-09-20)

- **Sin `@angular/fire`:** su última versión (20.0.1) solo declara soporte
  hasta Angular 20 vía peer dependency, y este proyecto está en Angular 21
  — instalarlo forzando el conflicto habría dejado una dependencia
  desalineada de la versión real de Angular sin necesidad real, cuando el
  SDK modular de `firebase` ya es suficiente. Se armó un envoltorio propio,
  mínimo, con el mismo espíritu que `API_PROVIDERS`:
  `core/firebase/firebase.tokens.ts` (`FIREBASE_APP`, `FIREBASE_AUTH`,
  `FIRESTORE_DB`) + `core/firebase/firebase.providers.ts`
  (`FIREBASE_PROVIDERS`, registrado en `app.config.ts`). Las fases 4-7
  inyectan `FIRESTORE_DB` en cada `*FirestoreApi`, igual que hoy inyectan
  `HttpClient`.
- **Categorías dejan de ser un recurso de API:** eran "catálogo fijo, sin
  edición desde la app" desde el principio (`CategoriasApi`, fase 1
  original) — en vez de una colección de Firestore que solo se lee y nunca
  cambia, ahora es una constante (`core/api/categorias/
categorias-catalogo.ts`) servida por una única implementación
  (`CategoriasStaticApi`, sin mock/HTTP/Firestore que elegir). Se borraron
  `categorias-http-api.ts` y `categorias-mock-api.ts` (apuntaban al backend
  descartado / duplicaban la misma lista).
- **`environment.ts`/`environment.prod.ts`:** se agregó `firebaseConfig`
  (del proyecto real `app-finanzas-4dd88` — el `apiKey` de un proyecto
  Firebase web no es secreto, el control de acceso lo hacen las Security
  Rules de la fase 3, no este archivo). `useMock` se deja en `true` en
  ambos entornos **temporalmente**: todavía hay 5 recursos
  (cuentas/movimientos/créditos/compras/pagos fijos) sin `*FirestoreApi`,
  así que sus `*HttpApi` (que apuntaban al backend descartado) seguirían
  rompiendo si se activaran. Cada fase 4-7 retira el mock de su recurso al
  llegar; `apiUrl` se retira del todo en la fase 8, cuando ya no quede
  ningún `*HttpApi`.
- **Presupuesto de bundle subido (`angular.json`):** el SDK de Firebase
  (Auth + Firestore) agrega ~350kB al bundle inicial incluso sin usarlo
  todavía más que para inicializar la app — `maximumWarning` 650kB→1MB,
  `maximumError` 1MB→1.3MB. El costo real para el usuario es mucho menor
  (~248kB transferidos, gzip) — la métrica del budget es sobre tamaño sin
  comprimir.
- `firebase.json` (Hosting, apunta a `dist/app-finanzas-frontend/browser`,
  rewrite de SPA) + `.firebaserc` (proyecto `app-finanzas-4dd88`) — listos
  para desplegar desde la fase 8, sin usarse todavía.
- 122 pruebas y build de producción verificados después del cambio.

### Fase 2 — Autenticación (2026-09-20)

- **Sin `/login` como ruta ni `authGuard`:** el plan original hablaba de un
  guard, pero con un solo usuario y **toda** la app detrás de sesión (no
  hay ninguna pantalla pública salvo el login), un guard por ruta
  duplicaría una decisión que ya es uniforme para las 5 rutas existentes.
  En vez de eso, `App` (`app.ts`) decide directo entre `Shell` y
  `LoginPage` según `AuthService.autenticado()` — más simple, sin rutas ni
  providers de más. El Router sigue funcionando normal por debajo: si
  alguien entra a una URL profunda sin sesión, `Shell` (y su
  `<router-outlet>`) simplemente no se monta hasta que haya sesión, y en
  ese momento el Router activa la última URL resuelta.
- **`core/auth/auth.service.ts`:** envuelve Firebase Auth
  (`onAuthStateChanged`, `signInWithEmailAndPassword`, `signOut`) sobre
  `FIREBASE_AUTH` (fase 1). `usuario` interno arranca en `undefined`
  ("todavía no se sabe" — Firebase tarda un instante en leer la sesión
  persistida) y solo pasa a `User | null` cuando `onAuthStateChanged`
  dispara la primera vez; `cargando()` distingue ese estado inicial para
  que `App` no le parpadee el login a alguien que sí tiene sesión.
- **Sin registro ni "olvidé mi contraseña"** (cambió el 2026-10-15, ver
  "Login con Google y registro abierto"): un solo usuario, creado a
  mano desde la consola de Firebase (Authentication → Users → Add user) —
  no hay endpoint ni pantalla que lo cree por código, igual que se había
  decidido para el backend descartado.
- **`features/login/`:** formulario simple (correo/contraseña) con las
  clases ya existentes del sistema de diseño (`.card`, `.field`, `.input`,
  `.btn-primary`, `.err`) — nada de Material aquí, mismo criterio que el
  resto de formularios de la app.
- **Botón de cerrar sesión** agregado al `Shell` (escritorio y móvil),
  junto al de ocultar montos.
- `app.spec.ts` reescrito: ya no monta `App` contra un `AuthService` real
  (dependería de Firebase de verdad) — usa un doble simple que pisa
  `cargando()`/`autenticado()`, con casos para sesión activa, sin sesión, y
  mientras Firebase todavía no resuelve. 124 pruebas en total (122 + 2
  nuevas), build de producción verificado.

**Antes de usar la app de verdad:** crea el usuario único en la consola de
Firebase — Authentication → Sign-in method → habilitar "Correo
electrónico/contraseña" (ya hecho), después Authentication → Users → Add
user, con el correo y contraseña que vayas a usar para entrar.

### Fase 3 — Reglas de seguridad de Firestore (2026-09-20)

- **`firestore.rules`:** una sola regla —
  `match /usuarios/{uid}/{document=**} { allow read, write: if
request.auth != null && request.auth.uid == uid; }` — cubre las 8
  colecciones de las fases 4-7 (cuentas, bolsillos, créditos y sus
  subcolecciones de extractos/cambios de tasa, compras, movimientos, pagos
  fijos): todas cuelgan de `/usuarios/{uid}/`, así que el dueño siempre es
  el mismo segmento de ruta. Todo lo que no calce con esa ruta queda
  cerrado (Firestore deniega por defecto).
- **Sin validación de forma/tipos por campo en las Rules, a propósito:**
  el único cliente que escribe ahí es esta misma app, y las reglas de
  negocio reales (cupo insuficiente, no doble pago del mes...) ya vivían
  solo en el cliente incluso cuando existía el backend propio — no hay
  ganancia real en duplicarlas en el lenguaje de las Rules.
- **Sin emulador de Firestore ni pruebas automatizadas de las Rules:**
  se evaluó (`@firebase/rules-unit-testing` + Firestore Emulator, ambos
  disponibles — el emulador ya se probó localmente una vez para validar
  que `firestore.rules` compila sin errores), pero automatizarlo de forma
  permanente chocaba con que `ng test` (el builder nativo de Angular 21,
  `@angular/build:unit-test`) descubre todo `*.spec.ts` sin una forma
  simple de excluir uno que dependa de un emulador corriendo aparte —
  cualquiera que corra `npm test` sin el emulador levantado vería fallar
  una prueba que no tiene nada que ver con lo que está tocando. Para una
  regla de 3 líneas, de un solo dueño, en una app de un solo usuario, el
  costo de esa infraestructura no se justificaba. Si hace falta
  reconsiderarlo (reglas más complejas en fases futuras), el emulador ya
  se probó y funciona (`firebase emulators:start --only firestore
--project demo-app-finanzas`).
- **`firebase.json`:** ahora referencia `firestore.rules`.
- **Deploy:** el primer intento falló con 401 — la sesión guardada de la
  CLI de Firebase en esta máquina tenía un refresh token corrupto/viejo
  (`firebase logout` lo confirmó: "Invalid refresh token"). Con
  `firebase logout` + `firebase login` de nuevo, `firebase deploy --only
firestore:rules` quedó desplegado sin problema —
  console.firebase.google.com/project/app-finanzas-4dd88/overview.

### Fase 4 — Cuentas y bolsillos (2026-09-21)

- **`core/api/cuentas/cuentas-firestore-api.ts`:** colección
  `usuarios/{uid}/cuentas` — cuentas y bolsillos en la misma colección,
  igual que ya hacía `CuentasMockApi` (un bolsillo es un documento con
  `cuentaPadreId` distinto de null). `listar`/`obtener` usan `onSnapshot`
  en vez de una lectura única: mismo espíritu que `ListStore` en el mock,
  las pantallas ya abiertas se actualizan solas si algo cambia (incluso
  desde otra pestaña/dispositivo — ventaja real de Firestore sobre el
  backend descartado).
- **`crearBolsillo` hereda `tipo`/`entidad`/`sumaEnDisponible` de la
  cuenta madre** (una lectura extra antes de escribir el bolsillo): tuve
  que leer `CuentasMockApi.crearBolsillo` con cuidado para replicar
  exactamente esos tres campos heredados, no solo `tipo` — es la única
  forma en que un bolsillo (que no pide esos campos en `NuevoBolsillo`)
  puede cumplir con que `Cuenta.tipo`/`entidad`/`sumaEnDisponible` no son
  opcionales en el modelo.
- **Firestore rechaza `undefined` en escrituras** (a diferencia de
  `JSON.stringify`, que lo ignora en silencio) — `crear`/`crearBolsillo`
  convierten `entidad`/`ultimos4` sin valor a `null` antes de escribir, y
  `actualizar` convierte cada campo en `undefined` a `deleteField()` en
  vez de guardarlo. Sin este manejo, guardar una cuenta con "Entidad"
  vacío habría reventado en tiempo de ejecución.
- **`AuthService` ganó `uid` (computed):** lo necesita cada
  `*FirestoreApi` para armar la ruta `usuarios/{uid}/...` — antes solo
  exponía `cargando`/`autenticado`.
- **`useMock` se queda, a propósito — corrijo lo que decía la fase 1:**
  la nota original decía que cada fase 4-7 "retira el mock" al llegar su
  `*FirestoreApi`. Lo pensé de nuevo: esto ya no es un backend de
  pruebas, es tu proyecto de Firestore real — desarrollar o probar
  pantallas nuevas contra él escribiría movimientos de mentira en tus
  cuentas de verdad. Mejor conservar el mock como modo seguro por
  defecto (`environment.useMock = true`) y cambiar a Firestore real solo
  cuando de verdad quieras probar contra datos reales. Se borró
  `cuentas-http-api.ts` (apuntaba al backend descartado), no
  `cuentas-mock-api.ts`.
- **Falta probar en vivo:** todavía no has creado el usuario de Firebase
  Auth (Authentication → Users → Add user), así que no he podido iniciar
  sesión de verdad para confirmar que `CuentasFirestoreApi` funciona
  contra el proyecto real — build y las 124 pruebas existentes pasan
  (ninguna ejercita Firestore real todavía, ver fase 3 sobre por qué no
  hay pruebas de emulador permanentes). Para probarlo: crea el usuario,
  pon `useMock: false` en `environment.ts` temporalmente, `npm start`,
  entra, crea una cuenta, confírmala en
  console.firebase.google.com/project/app-finanzas-4dd88/firestore — y
  después vuelve a poner `useMock: true`.
- Build de producción y 124 pruebas verificados (bundle inicial subió a
  1.15MB por el módulo de Firestore — sigue bajo el tope de error de
  1.3MB de la fase 1, sin necesidad de tocarlo de nuevo).

### Fase 5 — Movimientos (2026-09-21)

- **`core/firebase/firestore-docs.util.ts` (nuevo, compartido):** al
  llegar el segundo recurso a Firestore, `paraFirestore`/
  `paraActualizacion` (undefined→null / undefined→`deleteField()`, ver
  fase 4) dejaron de ser algo específico de cuentas — se movieron a un
  util compartido y `CuentasFirestoreApi` se refactorizó para usarlo
  también. Se agregó un tercero, `desdeFirestore<T>`, que hace el mapeo
  de lectura genérico (documento → tipo del dominio, `null`→`undefined`).
- **`CuentasFirestoreApi` NO usa `desdeFirestore` para leer, a
  propósito:** su `mapearCuenta` se quedó escrito a mano porque
  `cuentaPadreId: null` en `Cuenta` es un valor de dominio real ("esta
  es una cuenta raíz", lo usa `cuentas-agrupadas.ts` con `=== null`) y
  no un opcional ausente — pasarlo por el mapeo genérico lo habría
  convertido en `undefined` y roto ese chequeo. Antes de escribir
  `MovimientosFirestoreApi` con el mapeo genérico, confirmé (grep) que
  ninguno de los 7 campos opcionales de `Movimiento`
  (`categoriaId`/`cuentaOrigenId`/`cuentaDestinoId`/`creditoOrigenId`/
  `creditoDestinoId`/`pagoFijoId`/`periodo`) se compara contra `null` en
  ningún lado del código — ahí sí es seguro usarlo.
- **`core/api/movimientos/movimientos-firestore-api.ts`:** colección
  `usuarios/{uid}/movimientos`, sin lógica propia más allá del CRUD — a
  diferencia de cuentas, no hay herencia de campos ni casos especiales;
  `MovimientosMockApi` tampoco los tenía (la orquestación entre recursos,
  como borrar la `CompraCuotas` asociada a un gasto eliminado, vive en
  las pantallas que llaman a `ComprasApi` y `MovimientosApi` por
  separado, no dentro de ninguna de las dos APIs).
- Mismo criterio de la fase 4: se borró `movimientos-http-api.ts`
  (backend descartado), se conservó `movimientos-mock-api.ts` y
  `useMock` sigue siendo el interruptor seguro por defecto.
- Build y 124 pruebas verificados, bundle sin crecimiento notable (el
  costo grande del SDK de Firestore ya se pagó en la fase 4).
- Sigue pendiente de tu parte crear el usuario de Firebase Auth para
  poder probar esto (y la fase 4) contra el proyecto real.

### Fase 6 — Créditos (2026-09-21)

- **Extractos y cambios de tasa como subcolecciones de verdad:**
  `usuarios/{uid}/creditos/{id}/extractos` y `.../cambiosTasa`, en vez de
  filtrar una colección plana por `creditoId` como hacía
  `CreditosMockApi` — la ruta misma separa los de cada crédito, ni
  `listarExtractos` ni `listarCambiosTasa` necesitan `where`. Las reglas
  de la fase 3 ya cubrían esto sin cambios: `{document=**}` bajo
  `usuarios/{uid}` alcanza cualquier profundidad.
- **`Credito` es una unión discriminada por `grupo`** (tarjeta/banco/
  plataforma/persona) — se guarda y lee como documento "ancho" con los
  campos que aplican a cada grupo, igual que ya hacía el mock
  (`{ ...datos, id, archivado: false } as Credito`); Firestore no valida
  la forma, de eso se encarga el formulario, igual que antes.
- **`core/api/compras/compras-firestore-api.ts`:** `usuarios/{uid}/compras`
  es su propia colección (no anidada bajo créditos — así lo pide
  `ComprasApi`); `listarPorCredito` usa `where('creditoId', '==', ...)`,
  sin índice compuesto porque es una sola igualdad sin `orderBy`.
- Se borraron `creditos-http-api.ts` y `compras-http-api.ts` (backend
  descartado); `useMock` sigue siendo el interruptor seguro por defecto
  para ambos.
- Build y 124 pruebas verificados, sin crecimiento de bundle relevante.
- Sigue pendiente de tu parte crear el usuario de Firebase Auth para
  probar las fases 4-6 contra el proyecto real.

### Fase 7 — Pagos fijos (2026-09-21)

- **`core/api/pagos-fijos/pagos-fijos-firestore-api.ts`:** `usuarios/{uid}/
pagosFijos` — el recurso más simple de los 6, `PagoFijo` no tiene ni un
  campo opcional, así que el mapeo genérico de `firestore-docs.util` no
  tiene ninguna decisión que tomar (a diferencia de cuentas/movimientos).
- Se borró `pagos-fijos-http-api.ts`; `useMock` se conserva.
- **Con esta fase ya no queda ningún `*HttpApi` en el proyecto** (los 6
  recursos migraron) — `environment.apiUrl` quedó completamente muerto,
  listo para retirarse en la fase 8 junto con el resto de la limpieza
  final.
- Build y 124 pruebas verificados.

### Fase 8 — Integración final (2026-09-21)

- **`useMock` pasa a `false` por defecto, en los dos entornos** — cambio
  de plan respecto a lo que decía la fase 1 original ("se retira en la
  fase 8"): en vez de eliminar el interruptor, se invirtió su valor por
  defecto. Con los 6 recursos ya migrados, `true` había dejado de ser el
  modo seguro por defecto y pasó a ser el caso especial: ahora
  `ng serve` y el build de producción hablan con Firestore real desde el
  arranque, y `useMock: true` queda como algo que se activa a mano solo
  si vas a experimentar con una pantalla nueva sin tocar datos reales.
  Coincide con lo que ya habías hecho a mano en `environment.ts` para
  probar en vivo.
- **`apiUrl` retirado de `environment.ts`/`environment.prod.ts`:** no
  quedaba ningún `*HttpApi` que lo leyera desde la fase 7.
- **`environment.prod.ts` con `useMock: false` era el cambio crítico de
  esta fase:** había quedado en `true` desde la fase 1 (placeholder,
  "todavía no todos los recursos tienen FirestoreApi") — de no
  corregirlo, el sitio ya desplegado le habría mostrado datos de mentira
  a quien lo usara de verdad.
- **`README.md` reescrito** — tenía el texto genérico que deja
  `ng new` sin tocar. Ahora documenta la arquitectura (sin backend
  propio), cómo correr/probar/desplegar, y la estructura de carpetas.
- **`package.json`:** script `deploy` nuevo (`ng build && firebase
deploy --only hosting`).
- **Desplegado:** `firebase deploy --only hosting` — sitio en
  **https://app-finanzas-4dd88.web.app**. `firestore.rules` ya estaba
  desplegado desde la fase 3.
- Build de producción y 124 pruebas verificados una última vez.

Con esto, la migración completa de backend propio (Spring Boot,
descartado) a Firebase (Auth + Firestore + Hosting) queda cerrada: los 8
pasos planeados están hechos. Pendiente real, no de código: confirmar que
el uso diario contra Firestore de verdad (login, crear/editar en cada
pantalla) se sintió bien — si algo se ve raro, es más fácil de diagnosticar
ahora, recién migrado, que más adelante.

### Corrección — formularios de creación que no cerraban (2026-09-21)

Reportado al usar la app de verdad: los formularios de creación se
quedaban abiertos después de guardar.

**Causa probable:** los 5 formularios (`cuenta-form`, `bolsillo-form`,
`ajustar-saldo-form`, `pago-fijo-form`, `movimiento-form`) llamaban
`.subscribe(() => {...})` con un solo callback (`next`), sin manejar
`error`. Mientras las APIs fueron mock/`*HttpApi` esto nunca se notó
porque ahí un guardado prácticamente no podía fallar; con
`*FirestoreApi` (fases 4-7) un guardado sí puede fallar de verdad
(permisos de Firestore, red, sesión vencida...) y, al no tener manejador
de error, RxJS nunca corría el callback de éxito: `guardando` se quedaba
en `true` para siempre, el diálogo no se cerraba y no había ningún aviso
de que algo había fallado. No se pudo confirmar la causa exacta del
guardado fallido en sí (no hay acceso a la consola del navegador desde
acá) — lo de abajo corrige el síntoma real (que quede colgado sin avisar)
y, si el guardado sigue fallando, ahora se va a ver un mensaje en vez de
quedarse colgado.

**Estándar nuevo, para toda la app (web y móvil, es la misma UI
responsiva):**

- **`shared/guardado/guardado.util.ts`** — `guardarConFeedback(snackBar,
guardando, accion$, mensajeExito, alExito?)`: prende `guardando`,
  suscribe con `next`/`error`, y en cualquiera de los dos casos apaga
  `guardando` y muestra una alerta (`MatSnackBar`) — de éxito (corre
  `alExito`, normalmente cerrar el diálogo) o de error (mensaje genérico,
  sin cerrar nada, para poder reintentar). Usado en `cuenta-form`,
  `ajustar-saldo-form` y `pago-fijo-form`.
- **`mostrarErrorGuardado(snackBar, error)`** — la misma alerta de error,
  para los formularios con guardados encadenados (`bolsillo-form`:
  crear el bolsillo y opcionalmente un movimiento interno;
  `movimiento-form`: crear el movimiento y opcionalmente una compra a
  cuotas) que no encajan en la firma de un solo paso de
  `guardarConFeedback` — ahí cada paso de la cadena usa
  `.subscribe({ next, error })` a mano, con `error` llamando a un
  `fallo()` propio que delega en `mostrarErrorGuardado`.
- **`.spinner`** (nuevo en `_componentes.scss`) — un anillo simple que
  gira, CSS puro, del tamaño de un ícono inline (cabe en el `gap` de
  `.btn`). Se agregó dentro del botón de guardar de los 5 formularios,
  visible mientras `guardando()` es `true` — el "loader simple" pedido.
- Todo esto ya se veía parcialmente antes (`guardando()` deshabilitaba
  el botón, algunas pantallas ya mostraban una alerta de éxito) pero
  estaba duplicado a mano en cada formulario y sin manejo de error en
  ninguno. Ahora es un solo lugar (`guardado.util.ts`) que lo garantiza.
- Build, 124 pruebas y deploy a Hosting verificados.

**Causa raíz real, encontrada después:** no era (solo) el manejo de
errores — **el proyecto nunca tuvo una base de datos de Firestore
creada**. `firebase deploy --only firestore:rules` (fase 3) puede
"desplegar" reglas sin que exista la base de datos en sí, así que nunca
dio ningún error que lo delatara; recién se notó cuando la consola de
Firebase mostró el botón "Crear base de datos" en vez de datos. Sin base
de datos, cada lectura/escritura de cualquier `*FirestoreApi` fallaba
directo — de ahí que ni un formulario cerrara. Se creó con
`firebase firestore:databases:create "(default)" --location=nam5` y se
volvieron a desplegar las reglas sobre ella (`firebase deploy --only
firestore:rules`), confirmado con `firebase firestore:databases:list`.
El manejo de error agregado arriba sigue siendo correcto tenerlo (evita
que esto se repita en silencio con cualquier otra falla futura), pero
esta era la causa real de que nada guardara.

### Correcciones — pantalla de Cuentas (2026-09-21)

Pedidas explícitamente para "la ventana de cuentas" (`cuenta-form`,
`bolsillo-form`, `ajustar-saldo-form`, `cuentas.page`) — no se tocaron
`pago-fijo-form` ni `movimiento-form`, aunque el estándar nuevo de
cortina/loader queda listo para extenderse ahí si se pide.

1. **Campos obligatorios marcados** — `*` en la etiqueta (tipo, nombre,
   saldo inicial en `cuenta-form`; nombre en `bolsillo-form`; pieza,
   saldo real en `ajustar-saldo-form`) más un mensaje "Este campo es
   obligatorio." debajo del campo cuando está vacío y ya se tocó o se
   intentó enviar. Nuevo helper compartido:
   `shared/forms/campo.util.ts` (`campoInvalido`), para no repetir el
   mismo `control.invalid && (dirty || touched)` en cada formulario.
2. **Entidad/últimos 4 dígitos ocultos si el tipo es Efectivo** —
   `cuenta-form` ahora sigue el valor de `tipo` con un signal
   (`pideEntidad`) y esconde ese bloque completo; al cambiar a Efectivo
   también limpia lo que se hubiera escrito ahí, para que no quede
   guardado en silencio un dato de banco que ya no se ve.
3. **Cortina de guardado, en vez de solo el botón deshabilitado** —
   `shared/guardando-overlay/` (nuevo): un componente con `position:
fixed` que cubre la pantalla completa (incluido el botón de cerrar,
   ahora también deshabilitado mientras `guardando()`) con un spinner
   grande (`.spinner-grande`, variante de `.spinner` en
   `_componentes.scss`) y el texto "Guardando…". Primer intento con
   `position: absolute` + `position: relative` en el `:host` del
   formulario: no cubría nada, quedaba como un recuadro chico (el
   `display: contents` del host de por medio lo hacía frágil) —
   `fixed` no depende de eso y de paso cubre la pantalla real, no solo
   el recuadro del diálogo, que era el pedido original. Es el mismo
   componente para escritorio y móvil. Reemplazó al spinner chico
   dentro del botón en estos 3 formularios (sigue existiendo en
   `pago-fijo-form`/`movimiento-form`, que no se tocaron).
4. **Un solo botón "Agregar cuenta"** — se quitó el botón repetido que
   aparecía dentro de cada grupo vacío (Banco/Billetera/Efectivo/Otro);
   con 4 grupos, la mayoría vacíos al principio, terminaban saliendo
   hasta 5 botones iguales en pantalla. El estado vacío de cada grupo
   ahora solo indica que se use el botón general de arriba.

Build, 124 pruebas y deploy a Hosting verificados.

### Corrección — layout de móvil "pegado" en toda la app (2026-09-21)

Reportado: "todas las cards se ven demasiado pegadas [en móvil], parece
que la app solo fuera diseñada para web".

**Causa:** `.cols-2`/`.cols-3` (`_componentes.scss`) — el layout de
columnas que arma pantallas completas (General, Pagos fijos) — solo
tenían `display`/`gap` definidos **dentro** de `@media (min-width:
768px)`. Por debajo de ese ancho quedaban como `div`s sueltos sin
`display` ni `gap` propio: sus hijos (el hero, los KPIs, cada `.panel`)
se apilaban pegados, con cero espacio entre ellos — se veía bien en
escritorio (donde sí entraba el grid) y mal en el celular, que es
exactamente lo que se reportó. Afectaba sobre todo a **General**, la
pantalla de entrada por defecto, que arma toda su pantalla con
`.cols-3`.

Las demás pantallas (Cuentas, Créditos, Movimientos) no lo sufrían: ya
tenían su propio `:host { display: flex; flex-direction: column; gap:
var(--space-4); }` sin depender de `.cols-*`. Revisé el resto de
`@media (min-width` del proyecto (los de cada `*-form.scss`) y son solo
padding extra en pantallas grandes, no espaciado crítico — no tenían el
mismo problema.

**Corrección:** `.cols-2`/`.cols-3` ahora tienen una base para móvil
(`display: flex; flex-direction: column; gap: var(--space-4);`, una sola
columna apilada) antes del `@media`, que sigue igual y solo cambia
`display` a `grid` con columnas desde 768px.

Build, 124 pruebas y deploy a Hosting verificados.

### Mejora — acción de pantalla y menú de opciones en el header móvil (2026-09-21)

Pedido: mover "Agregar cuenta" al header móvil junto al ojito, y sacar
"cerrar sesión" a un menú "···" en vez de un ícono suelto. Análisis y
decisión (con el usuario, antes de tocar código): el menú "···" va en el
**header**, no en la barra inferior — esa barra son las 5 rutas de
navegación, meter ahí un ítem que abre un menú en vez de navegar rompe
la convención que cualquier usuario ya trae de otras apps.

- **`layout/header-action.service.ts`** (nuevo): la pantalla activa
  registra una acción (ícono + etiqueta + callback) con
  `establecer()`/`limpiar()`; el `Shell` la lee y la muestra como botón
  en el header **solo en móvil** (en escritorio cada pantalla ya tenía
  su botón de sobra, sin el problema de que se pierda al hacer scroll).
  Cada pantalla que la usa la limpia con `DestroyRef.onDestroy()` al
  salir — si no, el header le quedaría mostrando a otra pantalla una
  acción que apunta a un componente ya destruido.
- Usado en **`CuentasPage`** ("Agregar cuenta") y **`PagosFijosPage`**
  ("Nuevo pago fijo") — los dos casos que ya tenían este botón enterrado
  en el contenido. Su botón original ahora es `.solo-escritorio` (nueva
  utilidad en `_componentes.scss`): en móvil ya está en el header, no
  tiene sentido repetirlo en el contenido.
- **`MatMenuModule`** (nuevo en el proyecto): el ícono `more_vert`
  ("···") en el header — escritorio y móvil — abre un menú con "Cerrar
  sesión" adentro, listo para sumar más opciones de cuenta después sin
  seguir agregando íconos sueltos al header.
- Build, 124 pruebas y deploy a Hosting verificados (bundle 1.20MB, bajo
  el tope de 1.3MB de la fase 1 de la migración).

### Correcciones — 3 problemas de móvil reportados tras probar en iPhone (2026-09-21)

1. **El botón "Agregar cuenta" seguía apareciendo fuera del header en
   móvil.** Bug de orden en CSS, no del componente: `.solo-escritorio`
   (la fase anterior) y `.btn` fijan `display` cada uno por su lado, con
   la misma especificidad — `.btn` está declarado más abajo en
   `_componentes.scss`, así que ganaba por orden de aparición pese a que
   `.solo-escritorio` "debía" ganar. Corregido con `!important` en la
   utilidad (es justo el caso de uso correcto para `!important`: una
   clase de "esto manda sí o sí").

2. **El modal de agregar se veía "pegado"/desbordado en el celular.**
   Dos causas, las dos en cómo se abrían los diálogos
   (`dialog.open(...)` en `cuentas.page.ts`, `pagos-fijos.page.ts`,
   `movimientos.page.ts`, `nuevo-movimiento.service.ts` — 7 llamados en
   4 archivos):
   - Cada `dialog.open()` pasaba `maxWidth: '90vw'`. Angular Material
     **ya** acota sus diálogos a `calc(100vw - 32px)` por debajo de
     599px (se confirmó leyendo su CSS fuente en
     `node_modules/@angular/material`) — pero nuestro `maxWidth` se
     aplica como estilo inline y le gana a esa regla propia de Material,
     y `90vw` da menos margen real que el `calc(100vw - 32px)` que
     Material ya traía por defecto. Se quitó `maxWidth` de los 7
     llamados: ahora manda el default de Material, que además coincide
     con `--space-4` (16px), el mismo margen que usa el resto de la app.
   - Ningún diálogo tenía `maxHeight`: uno más alto que la pantalla (muy
     típico con el teclado del celular abierto, que reduce el viewport
     visual a la mitad) no scrolleaba solo — se desbordaba sin forma de
     llegar al botón de guardar. Se agregó `maxHeight: '90vh'` a los 7.
3. **La barra inferior (y el resto del contenido fijo) se veía cortada
   por los bordes redondos del iPhone 15**, al usar la app instalada
   como ícono de inicio. Causa: `index.html` nunca tuvo
   `viewport-fit=cover` en el `<meta name="viewport">` — sin eso,
   `env(safe-area-inset-*)` (ya usado desde antes en
   `.barra-inferior`/`.fab-nuevo`/`.contenido--movil`, ver `shell.scss`)
   **siempre vale 0**: el código para respetar el notch/borde redondeado
   ya existía, pero nunca se activaba. Se agregó `viewport-fit=cover`, y
   de paso `apple-mobile-web-app-capable`/`-status-bar-style`/`-title`
   (nada de esto se leía antes — Safari en iOS no usa un manifest de PWA
   para el modo "ícono de inicio", son meta tags aparte). También se le
   sumó `padding-top` con `env(safe-area-inset-top)` al header móvil
   (antes solo el inferior lo tenía). **Importante:** iOS puede guardar
   la configuración del ícono al momento de agregarlo a inicio — si no
   se ve el cambio, prueba quitando el ícono de la pantalla de inicio y
   agregándolo de nuevo.

Build, 124 pruebas y deploy a Hosting verificados.

### PWA — instalable en iOS/Android (2026-09-21)

Pedido explícito: convertir el proyecto en PWA de verdad (no solo las
meta tags sueltas de la corrección anterior), con `ng add @angular/pwa`.

- **`ng add @angular/pwa`** — agregó `@angular/service-worker`,
  `ngsw-config.json` (cachea el app shell — HTML/CSS/JS — para carga
  offline después de la primera visita; imágenes/íconos con
  `installMode: lazy`), `provideServiceWorker(...)` en `app.config.ts`
  (`enabled: !isDevMode()`, no corre en `ng serve`), `public/
manifest.webmanifest` con 8 tamaños de ícono (72 a 512px, **el
  placeholder del logo de Angular que trae el schematic — no arte
  propio de la app, hay que reemplazarlo cuando exista uno real**), y
  actualizó `angular.json`/`index.html` (agregó `<link rel="manifest">`).
- **`manifest.webmanifest`:** se completó a mano lo que el schematic
  deja en blanco — `name`/`short_name`/`description` (traía el nombre
  del paquete npm), `theme_color`/`background_color` (tomados de
  `--accent`/`--bg-page` en modo claro, `_primitivas.scss`),
  `orientation: portrait`. `display: standalone` ya venía bien por
  defecto — es justo lo que hace que no se vea la barra de Safari.
- **`index.html`:** se sumaron `theme-color` (mismo valor que el
  manifest) y `apple-touch-icon` (Safari no lee `icons` del manifest
  para el ícono de inicio, necesita su propio `<link>`) — el resto de
  las meta tags de iOS (`apple-mobile-web-app-capable`/
  `-status-bar-style`/`-title`, `viewport-fit=cover`) ya se habían
  agregado en la corrección anterior.
- Build, 124 pruebas y deploy a Hosting verificados —
  `dist/.../browser` ya incluye `ngsw-worker.js`/`ngsw.json` además del
  manifest y los íconos.

**Íconos reales (mismo día):** los 8 PNG placeholder (logo de Angular)
se reemplazaron por un diseño propio simple — "$" blanco sobre círculo,
fondo a sangre completa en `#185fa5` (mismo `theme_color`). El
contenido queda dentro del "safe zone" (círculo central ~80% del
lienzo) para no cortarse al enmascarar en Android (`purpose: "maskable
any"` en el manifest, sin cambios). Sin herramienta de conversión
SVG→PNG instalada en el equipo (ni ImageMagick ni Inkscape en el
`PATH`) — se generó con `sharp` instalado **temporalmente**
(`npm install --no-save sharp`, luego `npm uninstall sharp` al
terminar, para no dejarlo como dependencia real del proyecto). Fuente
editable versionada en `scripts/icon-source.svg` +
`scripts/generar-iconos.mjs` (documentado en el README, sección "PWA /
instalar en el celular") para poder regenerar los 8 tamaños si cambia
el diseño o llega un logo de marca real.

Build, 124 pruebas y deploy a Hosting verificados de nuevo tras el
cambio de íconos.

### Corrección — íconos PWA rediseñados (2026-09-21)

Reportado: "los logos estan horribles" (el "$" en Arial sobre un círculo,
ver sección anterior). Rediseñados sin texto — 3 barras ascendentes
(blanco) sobre un degradado azul (`--p-blue-400` → `--p-blue-800`), mismo
proceso de generación (`scripts/icon-source.svg` + `generar-iconos.mjs` +
`sharp` temporal). Build, 124 pruebas y deploy verificados.

### Corrección — título del estado vacío desproporcionado en móvil (2026-09-21)

Reportado con captura: en Cuentas (móvil), "Sin cuentas en este grupo" se
veía enorme comparado con el resto de las filas.

**Causa:** `shared/empty-state/empty-state.html` usaba `.t-kpi` (18px/500 —
la misma clase de los números grandes de "Disponible"/"Reservado") para el
título, en vez de `.t-row` (14px, igual al resto de las filas de la lista).
Corregido a `.t-row`. El componente también lo usan Pagos fijos y
Movimientos, así que el ajuste aplica en las tres pantallas. Build, 124
pruebas y deploy verificados.

## Movimientos — buscador en el header y hoja de filtros (2026-09-22)

Handoff de diseño explícito (texto completo en la conversación) para la
tab Movimientos, por debajo de 768px: el buscador fijo sobre la lista pasa
a una lupa en el header que abre una barra de búsqueda; los filtros en
línea (chips + selects + switch) pasan a un solo chip "Filtros" con badge
que abre un `MatBottomSheet`. En escritorio el patrón no cambia — se le
suman dos campos de fecha (Desde/Hasta) siempre visibles. Antes de
implementar, analicé el código existente y confirmé con el usuario los dos
puntos que el handoff marcaba como "sin definir": el término de búsqueda
se limpia al cambiar de mes/tab (no persiste), y el rango Desde/Hasta se
limita siempre al mes ya seleccionado arriba (no cruza meses) — las dos,
las opciones recomendadas por el propio handoff.

- **Dominio (`core/domain/movimientos-agrupados.ts`), puro, con
  pruebas:** `FiltroFecha` ('todo-mes'/'hoy'/'7-dias'/'rango') se sumó a
  `FiltrosMovimientos` (antes solo tenía tipo/cuenta/categoría/texto/
  internos). `filtrarMovimientos` ahora recibe `hoy: Date` explícito (no
  `new Date()` interno — mismo criterio que `estadoPagoCredito`, para
  seguir siendo puro y testeable) para los modos 'hoy'/'7-dias'. Nuevas
  funciones: `contarFiltrosActivos` (badge del chip, no cuenta el texto:
  "es búsqueda, no filtro") y `categoriasConMovimientos` (el filtro de
  categoría — móvil y escritorio — ahora solo ofrece categorías con al
  menos un movimiento en el mes, antes listaba el catálogo completo
  siempre; cambio de comportamiento real, no solo de layout, aplicado a
  los dos porque no tenía sentido que difirieran). `fechaIsoDesdeLocal`
  (inversa de `fechaLocalDesdeIso`, ya existente) se agregó a `fechas.ts`
  y de paso reemplazó una versión duplicada a mano en
  `movimiento-form.ts`.
- **`HeaderSearchService`** (nuevo, `layout/`): a diferencia de
  `HeaderActionService` (un botón más junto al ojito), esta reemplaza el
  header móvil **entero** por la barra de búsqueda — por eso vive como
  servicio aparte que el `Shell` consulta directamente, no como una
  acción más del primero. Mismo patrón `registrar()`/`limpiar()` con
  `DestroyRef` que ya usaba `HeaderActionService`. El término nunca
  persiste (`cerrar()` y `limpiar()` lo vacían) — decisión confirmada
  arriba.
- **`Shell`:** rama móvil ahora tiene un `@if` extra —
  `headerSearch.abierta()` decide entre el header normal y la barra de
  búsqueda. Autofocus del campo hecho a mano con `viewChild` + `effect()`
  (el atributo `autofocus` no es confiable en un `<input>` que entra por
  `@if`, ya que no es "carga inicial de la página" para el navegador).
- **`MovimientosFiltrosSheet`** (nuevo, `features/movimientos/
movimientos-filtros-sheet/`): abierto con `MatBottomSheet` (mismo
  patrón que `MovimientoForm` en móvil, ver `NuevoMovimientoService`).
  Estado en **borrador**: los chips de cada grupo (Tipo/Fecha/Cuenta o
  crédito/Categoría, todos de selección única) más el switch de internos
  escriben un signal local; "Aplicar" hace `dismiss(draft)`, la X y el
  fondo hacen `dismiss()` sin argumento (comportamiento por defecto de
  `MatBottomSheet`) y `MovimientosPage` simplemente no hace nada si
  `afterDismissed()` no trae resultado. "Limpiar" reinicia el borrador
  sin cerrar la hoja ni tocar el texto de búsqueda (no es parte de esta
  hoja). El pie con los dos botones queda fijo con flex-column +
  `overflow-y` solo en el cuerpo — **no** con `position: fixed` (el
  contenedor de `MatBottomSheet` anima con `transform`, que crea un
  nuevo _containing block_ y habría roto un hijo `fixed`).
- **`MovimientosPage`:** `texto` de búsqueda ya no es un solo signal —
  en escritorio lo escribe el campo propio de la página
  (`textoEscritorio`), en móvil la barra del header
  (`HeaderSearchService.termino()`); `textoBusqueda` combina el que
  aplica según `ViewportService.esMovil()`. El resto de los filtros
  (tipo/fecha/cuenta/categoría/internos) viven en un solo signal
  `filtros: FiltrosMovimientos`, porque la hoja los actualiza todos de
  una vez. En escritorio los campos Desde/Hasta siempre visibles operan
  igual que el modo 'rango' de la hoja (sin un selector de modo aparte:
  escribir cualquiera de los dos pone `fecha: 'rango'`), inicializados a
  los bordes del mes vía `??` en el template (sin tocar el signal hasta
  que el usuario edita algo de verdad). Cambiar de mes reinicia
  fecha/búsqueda (`cambiarMes()`) pero conserva tipo/cuenta/categoría/
  internos.
- **Bug propio, atrapado antes de desplegar:** el primer intento limpiaba
  `textoEscritorio` por código al cambiar de mes, pero el `<input>` de
  escritorio no tenía `[value]` enlazado (solo capturaba el evento
  `input`) — el signal se vaciaba pero el cuadro de texto seguía
  mostrando lo último escrito, desincronizado del filtro real. Corregido
  agregando el `[value]` que faltaba.
- **Sin probar visualmente en navegador** — sin una herramienta de
  browser disponible en esta sesión, la verificación fue build + las 24
  pruebas de dominio nuevas (130 en total) + revisión manual del código.
  Antes de darlo por bueno del todo, revisa en el celular de verdad: que
  la hoja de filtros no se corte con el teclado abierto, que los chips de
  cuenta/categoría no se vean raros si hay muchas opciones, y que el
  autofocus del buscador funcione en Safari iOS.

Build, 130 pruebas y deploy a Hosting verificados.

### Corrección — mismo bug de texto gigante, esta vez en General (2026-09-22)

Reportado con captura: "Nada por pagar", "Sin cuotas pendientes", "Sin
gastos este mes" y "Sin movimientos" (los 4 estados vacíos de la tab
General) se veían igual de grandes que el título "Disponible"/"Gastos".
Mismo bug que el de Cuentas (`.t-kpi` en vez de `.t-row`, corregido arriba
en `shared/empty-state`) — pero General nunca usaba ese componente
compartido: tenía su propio `<div class="empty"><span class="t-kpi">...`
copiado a mano 4 veces. Se reemplazaron los 4 por `<app-empty-state
titulo="..." descripcion="..." />`, ya corregido — en vez de arreglar el
tamaño ahí también, se eliminó la duplicación de raíz. Sin más lugares con
este patrón (`grep` de `class="empty"` en toda la app). Build, 130 pruebas
y deploy verificados.

## Selector manual de tema claro/oscuro (2026-09-22)

Pedido: agregar al menú "···" (junto a "Cerrar sesión") la opción de
cambiar el tema, además del automático por sistema que ya existía. El CSS
para esto ya estaba parcialmente preparado desde la fase del sistema de
diseño (`_semanticos.scss` traía `body.dark-theme` "listo pero sin control
en la interfaz" — ver sección "Sistema de diseño" más abajo) pero con un
mecanismo distinto (`class` en `body`) al que ya insinuaba el propio CSS
para forzar claro (`:root:not([data-theme='light'])`, con `data-theme` en
`<html>`) — se unificó todo bajo `data-theme` en `<html>`, con 3 estados
reales: sin atributo (sigue al sistema en vivo), `'claro'`, `'oscuro'`.

- **`core/theme.service.ts`** (nuevo): mismo patrón que `ViewportService`
  para seguir el sistema en vivo (`BreakpointObserver.observe('(prefers-
color-scheme: dark)')` + `toSignal`, en vez de un listener de
  `matchMedia` a mano). `oscuro()` combina el override manual (si existe)
  con el del sistema. `alternar()` fija el override y lo guarda en
  `localStorage` (clave `finanzas.tema`) para que sobreviva a un recargo.
- **`_semanticos.scss`:** `body.dark-theme` (nunca tuvo ningún control que
  lo activara) se reemplazó por `:root[data-theme='dark']`, junto al guard
  de claro que ya existía — un solo mecanismo, no dos.
- **Parpadeo al cargar, corregido con un script inline en `index.html`:**
  sin esto, la página siempre arranca con el tema del sistema (CSS puro,
  instantáneo) y solo después de que el bundle de Angular carga,
  `ThemeService` aplicaría el override guardado — visible como un
  parpadeo si el override difiere del sistema. El script lee
  `localStorage` y fija `data-theme` antes de la primera pintada,
  bloqueante a propósito, sin dependencias (no puede importar la
  constante de la clave de `theme.service.ts` — corre antes de que exista
  cualquier bundle; quedó comentado en los dos lados para que no se
  desincronicen si cambia).
- **`Shell`:** nuevo ítem en los dos menús "···" (escritorio y móvil,
  antes de "Cerrar sesión") — ícono y texto describen la acción que va a
  ejecutar ("Modo oscuro"/"Modo claro"), mismo criterio que el botón de
  ocultar montos ya usaba.
- Sin opción "Automático" para volver al sistema después de haber elegido
  manualmente — no se pidió, y agregarla habría sido un menú de 3
  opciones en vez de un toggle. Si hace falta más adelante, se puede
  sumar sin rehacer nada (el `null` de "sigue el sistema" ya existe
  internamente en `ThemeService`, solo falta exponerlo).

Build, 130 pruebas y deploy a Hosting verificados.

### Corrección — el botón de tema no hacía nada (2026-09-22)

Reportado: "el boton no hace nada". Bug propio, de escribir el CSS antes
de fijarme en qué valores usa el servicio: `ThemeService` fija
`data-theme="claro"`/`"oscuro"` (español, como todo lo demás del
servicio), pero `_semanticos.scss` tenía los selectores en inglés
(`[data-theme='light']`/`[data-theme='dark']`, arrastrados sin querer del
comentario original que hablaba de esto en abstracto). El atributo sí
cambiaba en el DOM al hacer clic — por eso el ítem del menú sí cambiaba de
texto ("Modo claro"/"Modo oscuro") — pero como el selector CSS nunca
coincidía, ningún color cambiaba. Corregido a `[data-theme='claro']`/
`[data-theme='oscuro']`, verificado además en el CSS compilado (no solo
leyendo el `.scss`). Build, 130 pruebas y deploy verificados.

### Corrección — el service worker dejaba la app vieja cacheada tras cada deploy (2026-09-22)

Reportado (otra vez, después del fix anterior): "ni mierda nada". La
corrección del CSS sí quedó bien (verificado en el CSS compilado), pero el
service worker de la PWA (agregado esta misma sesión, ver "PWA — instalable
en iOS/Android" más arriba) cachea el app shell agresivamente — por diseño,
Angular descarga la versión nueva en segundo plano pero **no la aplica**
hasta que la pestaña/app se cierre del todo y se vuelva a abrir. Cada
prueba inmediatamente después de un deploy estaba viendo la versión
anterior, no la corregida — ya lo advertía el propio README ("PWA /
instalar en el celular", sección "Caché") pero nunca se había topado con
esto en la práctica hasta ahora.

**Corrección real:** `App` (`app.ts`) ahora se suscribe a
`SwUpdate.versionUpdates` y, apenas hay una versión lista
(`VERSION_READY`), recarga la página sola — sin preguntar, correcto para
una app de un solo usuario. `SwUpdate` se inyecta con `{ optional: true }`
porque `app.spec.ts` arma su propio `TestBed` sin `provideServiceWorker`
(no tiene sentido agregarlo ahí solo para esto).

**Importante, de una sola vez:** este mismo deploy (el que trae el
auto-recargo) todavía tiene que pasar por el service worker VIEJO para
llegar — ese viejo no sabe recargar solo. Por única vez hay que forzar una
carga fresca a mano: cerrar la pestaña/app del todo y volver a abrirla; si
sigue sin verse el cambio, en iPhone es Ajustes → Safari → Avanzado →
Datos de sitios web → buscar el sitio → eliminar (vuelve a pedir inicio de
sesión). De ahí en adelante, cada deploy futuro se aplica solo.

Build, 136 pruebas y deploy a Hosting verificados.

## Cinco temas, cada uno en claro y oscuro (2026-10-28)

El tema (la paleta) y el modo (claro/oscuro) pasaron a elegirse por separado:
`data-theme` = `teal | neutro | medianoche | brasa | marino` y `data-modo` =
`claro | oscuro` en `<html>`. Brasa (ciruela con un coral suave, tomado de Superlist; la primera versión, con un naranja puro, resultó demasiado fuerte) y
Marino (azul tinta con azul de señal) son nuevos, tomados como inspiración de
dos referencias de Refero; Teal y Neutro ganaron modo oscuro y Medianoche
ganó modo claro.

- **`_primitivas.scss`:** rampas nuevas `--p-noche-claro-*`, `--p-ciruela-*`,
  `--p-coral-*`, `--p-marino-*`, `--p-senal-*` (más `azul-100/600`).
- **`_semanticos.scss`:** un mixin por tema y modo (`tokens-<tema>-<modo>`) y
  diez reglas `:root[data-theme][data-modo]`. Sobre el coral de Brasa va
  texto ciruela oscuro (el blanco no llega a AA); como texto, `coral-700`
  (claro) y `coral-300` (oscuro).
- **`ThemeService`:** claves `finanzas.tema` y `finanzas.modo`. Sin migración
  de lo guardado: un valor viejo (`claro`/`oscuro` en `finanzas.tema`) cae al
  default (Teal claro). `soloClaro()` (login) fuerza Teal claro y
  `soloModoClaro()` (bienvenida) fuerza solo el modo claro.
- **UI:** el menú de tema del `Shell` lista las cinco paletas y debajo
  Claro/Oscuro. Sin modo automático (no sigue al sistema).
- **Contraste:** `verificar-contraste.mjs` ahora recorre los diez
  tema×modo y resuelve los `@include`; los diez cumplen AA. Para eso se
  ajustaron `gris-600`, `marino-ink-600` y los `accent-on-inverse`.
- **Pendiente:** revisar a mano las gráficas (`paleta-graficas.ts` sigue con
  solo dos paletas, claro y oscuro) y los estados de cada pantalla en los
  temas nuevos.

## Rediseño de UI (2026-09-22 → 2026-09-23)

Registro reconstruido el 2026-09-25 a partir de los mensajes de commit y los
diffs: el trabajo se hizo en dos días seguidos sin pasar por este archivo, y
sin él no quedaba dónde leer en qué había terminado. Es la única tanda del
proyecto documentada después de los hechos, no durante.

Contexto: la app ya estaba funcionando contra Firestore (ver "Migración a
Firebase" más arriba) y lo que faltaba era lo visual. El repositorio de git
nace justo acá — `533eddc chore: commit inicial del estado actual antes del
rediseño de UI` es el commit raíz, así que todo lo anterior a esta sección
solo está registrado en este archivo, no en el historial.

Fueron dos tandas distintas, con criterios distintos:

| Tanda                   | Qué se permitía tocar                                     | Commits               |
| ----------------------- | --------------------------------------------------------- | --------------------- |
| Fases 1-5               | Todo: paleta, tokens, tipografía, estructura, movimiento  | `6e632c3` … `3a49641` |
| Reorganización del mock | **Solo estructura** — ni tokens, ni paleta, ni tipografía | `074e64f` … `65aeeab` |

| Fase                      | Contenido                                               | Estado                |
| ------------------------- | ------------------------------------------------------- | --------------------- |
| 1. Sistema de diseño      | Paleta neutra fría, tokens completos, componentes base  | ✅ Hecha              |
| 2. Layout                 | Grid de 12 columnas, alineación, navegación             | ✅ Hecha              |
| 3. Pantallas              | Las cinco pantallas + gráficas                          | ✅ Hecha              |
| 4. Movimiento             | `animate.enter`, view transitions, motion, auto-animate | ✅ Hecha              |
| 5. Revisión               | Correcciones encontradas en 390/768/1440/1920           | ✅ Hecha              |
| — Reorganización del mock | Cabecera + las cinco pantallas, 7 bloques               | ✅ Hecha y desplegada |

### Fase 1 — Sistema de diseño (2026-09-22)

Reemplaza la paleta cálida "sand/ink/night" del prototipo original por una
neutra fría (referencias: Stripe Dashboard, Linear, Revolut) y sube a la capa
de tokens todo lo que vivía como `px` sueltos dentro de `_componentes.scss`.

- **Tokens nuevos:** tipografía por rol (`--text-2xs`…`--text-hero`, el héroe
  con `clamp()` para que un monto de 12 dígitos no desborde en 360px ni se
  vuelva cartel en 1920px), escala de espaciado de 4px completa, radios,
  sombras distintas por tema (en fondo oscuro la sombra es negro casi opaco,
  no gris), movimiento (`--dur-*` 150-250ms, `--ease-*`) y layout/foco
  (`--layout-max`, `--tap-min` 44px, `--focus-*`).
- **Contraste verificado, y con red:** la paleta pasa WCAG AA en los dos
  temas. El pipeline salió del propio audit — `--text-muted` era ilegible
  sobre inset, el blanco sobre el acento del tema oscuro daba 2.87:1 (ahora
  es texto oscuro sobre acento brillante, patrón Linear/Vercel) y el borde de
  control no llegaba a 3:1, que es su requisito por ser la única señal del
  campo. `scripts/verificar-contraste.mjs` (`npm run verificar:contraste`)
  lee los tokens reales y falla si alguien rompe un par, así que no puede
  quedar desactualizado.
- **Componentes base:** `empty-state` gana ícono, título, descripción y
  acción (un vacío que solo dice "Sin movimientos" se lee como un error; con
  ícono y acción se lee como una invitación); `stat-card` y `skeleton-rows`
  nuevos; `card`, `panel`, `chip`, `row`, `badge`, `bar` y `skeleton`
  refinados. Viven en `_componentes.scss` y no en cada página porque el
  presupuesto `anyComponentStyle` es de 4kB. El chip mide 36px pero extiende
  su área táctil a 44px con un pseudo-elemento, para cumplir el mínimo sin
  inflar las filas de filtros.
- Se deja de pedir Roboto (solo era respaldo del stack) y se pide Inter
  variable 400..600: el 600 se usa de verdad y antes el navegador lo
  sintetizaba en falso negrita.

`styles.css` 23.06 → 33.34 kB en crudo. 136 pruebas.

### Fase 2 — Layout, alineación y navegación (2026-09-22)

La navegación que pedía la fase ya existía casi entera (barra inferior, FAB,
tabs de escritorio, safe-area, contenedor de 1200px); lo que faltaba era
alineación y el grid.

- **`.grid-12`** con `.col-md-*` (≥768px) y `.col-lg-*` (≥1024px). En móvil no
  hay columnas: todo hijo ocupa el ancho completo, que es lo que se quiere
  entre 360 y 767px y evita una clase por breakpoint para el caso común.
- **La barra superior se alinea con el contenido:** mismo `--layout-max` y
  mismo gutter. Antes, en 1920px, la marca quedaba contra el borde de la
  ventana y el contenido centrado — dos alineaciones en la misma pantalla.
- **Causa concreta del desalineado reportado:** los `max-width: 680px`
  sueltos de Cuentas y Créditos dejaban la lista en la mitad izquierda
  mientras el encabezado usaba los 1200px completos. Se quitan; el ancho lo
  decide el grid de la página.
- **Botón del ojo:** "Próxima cuota · capital / interés" en Créditos
  imprimía el monto con el pipe directo y se saltaba el ocultar-montos.
  Quedan fuera a propósito tres montos, los tres dentro de formularios
  modales (saldo actual en "Ajustar saldo", saldo libre en "Agregar
  bolsillo", cuota aproximada en el formulario de movimiento): son el dato de
  referencia contra el que se llena el campo de al lado, ocultarlos no
  protege nada — ya abriste el formulario — y vuelve el formulario inusable.
- Los offsets del FAB y el padding inferior salen de tokens
  (`--altura-barra-inferior`, `--altura-fab`) en vez de números mágicos, y
  una auditoría de `px` sueltos en los `.scss` de features pasa los 44px
  literales a `var(--tap-min)`.

### Fase 3 — Las cinco pantallas, con gráficas (2026-09-22)

Todas las pantallas pasan al grid de 12 columnas, así que encabezado y
contenido arrancan en la misma columna.

- **General:** héroe "Te queda libre este mes" (rojo si es negativo), cuatro
  stat-cards en 2x2 — cuatro en fila dejan ~165px cada una y
  "$12.345.678.900" no entra —, dona de gastos por categoría, mini tendencia,
  íconos por fila derivados del tipo de movimiento, y **esqueletos de carga**:
  `toSignal(..., {initialValue: []})` no distingue "todavía no llegó" de
  "llegó vacío", y sin eso la pantalla mostraba "Sin movimientos" durante el
  primer segundo contra Firestore.
- **Cuentas:** se ocultan los grupos vacíos. Quien solo usa efectivo veía
  tres tarjetas vacías antes de llegar a lo suyo. El filtro es de
  presentación: `agruparCuentasPorTipo` sigue devolviendo los cuatro tipos,
  que es lo correcto para el dominio.
- **Créditos:** barra de progreso también en tarjetas y plataformas,
  reusando `creditosConCuotasPendientes`. La de los bancos no cambia: sigue
  contando cuotas pagadas, no transcurridas — son dos números distintos.
- **Movimientos:** buscador y chips de tipo siempre visibles; fechas, cuenta,
  categoría e internos a un panel colapsable cerrado por defecto. De los
  siete controles que estaban a la vista, dos se usan a diario y el resto
  llenaba media pantalla antes de la lista.
- **Pagos fijos:** la barra del héroe ahora dice qué mide ("N de M pagados" y
  el porcentaje); secciones Por pagar / Pagados con su conteo.
- **Gráficas con `ng-apexcharts`** y no `ngx-echarts`: esa va en v22 con peer
  `@angular/core >=22` y el proyecto está en 21. La paleta categórica se
  validó contra las superficies reales en los dos temas (banda de luminosidad,
  croma, separación bajo protanopia/deuteranopia); en tema claro tres slots
  quedan bajo 3:1, lo que obliga a etiquetas visibles — por eso la leyenda con
  nombre y monto es parte del componente, no un adorno. **Un solo eje en la
  tendencia:** las dos series son pesos, y con dos escalas "los gastos
  pasaron a los ingresos" sería verdad o mentira según cómo quedó el gráfico.
  Los colores de eje y grilla se leen de los tokens en tiempo de ejecución
  con `getComputedStyle`, en vez de duplicar los hex del tema en TS.
- **Dominio:** `core/domain/tendencia-mes.ts` (nuevo, 10 pruebas) — serie
  diaria acumulada de ingresos vs gastos, con la misma regla de
  `resumenMovimientos` para que el panel no se contradiga con los KPIs.
  Corta la serie en hoy si es el mes en curso: dibujarla hasta el 30 estando
  en el 12 pinta 18 días planos que se leen como "dejé de gastar".
- **Service worker:** el `/*.js` en prefetch descargaba en la instalación
  todos los chunks perezosos, incluidos los ~1.9 MB de ApexCharts y su bundle
  de SSR, que acá no se usa nunca. Pasa a un grupo `lazy` con
  `updateMode: prefetch`.

### Fase 4 — Movimiento (2026-09-22)

Angular 21.2 está por encima de 20.2, así que se usa `animate.enter` /
`animate.leave` con clases CSS y **se retira `@angular/animations`**:
`provideAnimationsAsync()` está marcado `@deprecated 20.2 ... Intent to
remove in v23` apuntando justo ahí, Material 21 ya no lo declara como peer
dependency y ninguna de sus piezas lo importa en código. Diálogo, menú, tabs,
snackbar y hoja inferior siguen animando sin él.

- `withViewTransitions()` en el router, con el aspecto en CSS
  (`::view-transition-old/new(root)`): fundido corto con 4px de
  desplazamiento. Donde el navegador no soporta la API, la navegación es
  instantánea como antes.
- **Conteo animado de montos** solo en los que lideran una pantalla (héroe y
  stat-cards): veinte contadores en una lista serían ruido, no jerarquía.
  Dura 550ms y no 150-250ms a propósito — a 250ms es un parpadeo que no se
  alcanza a leer.
- **`auto-animate` con directiva propia** (`shared/motion/auto-animar.ts`) en
  vez de la de `@formkit/auto-animate/angular`: esa clase se publica con los
  decoradores de TypeScript sin compilar, así que no trae la definición que
  necesita el compilador AOT y el build falla con NG2012. La API vanilla sí
  sirve y además deja fijar duración y curva. Donde más se nota es en Pagos
  fijos: al marcar un pago, la fila se ve salir de "Por pagar" y aparecer en
  "Pagados".
- El detalle expandible de Cuentas/Créditos/Movimientos pasa de
  `display: none` a un `@if` estructural: con `display` no hay nada que
  animar, el alto salta de golpe.
- **Rendimiento:** las barras dejan de animar `width` (recalcula layout en
  cada cuadro) y pasan a `transform: scaleX(var(--progreso))`. Todo lo
  animado es `transform` u `opacity`.
- **`prefers-reduced-motion`:** los `--dur-*` bajan a ~0, así que cualquier
  transición de CSS se apaga sola; el movimiento escrito en JS lo consulta
  aparte (`shared/motion/preferencias-movimiento.ts`, compartido con las
  gráficas).

### Fase 5 — Revisión en 390/768/1440/1920 (2026-09-23)

Revisión de las cinco pantallas en los cuatro anchos, con datos de prueba, en
los dos temas, con montos ocultos, con estados vacíos y forzando
"$12.345.678.900" en todos los montos. Todo lo que sigue son defectos
encontrados ahí, no cambios de diseño.

- **Desborde horizontal entre 768 y 1023px:** Material le pone
  `flex: 0 0 auto` al `mat-tab-nav-bar`, así que no cedía ancho y empujaba al
  resto fuera de la ventana (1032px en un viewport de 753).
- **El signo quedaba en su propio renglón:** `.row-end` es un contenedor flex
  en columna, así que el nodo de texto suelto del signo ("+", "−", "~") se
  volvía su propio ítem. Signo y monto pasan al mismo `<span>`, y la regla
  queda documentada en `.row-end` para no repetir el error.
- **El monto podía quedarse en "$0" para siempre:** el conteo arranca en cero
  y `motion` avanza con `requestAnimationFrame`, que el navegador no ejecuta
  en una pestaña en segundo plano — abrir la app en una pestaña de fondo
  dejaba el monto en cero de forma permanente. Ahora no se cuenta si el
  documento no está visible, se fija el valor exacto al terminar, y queda una
  red de seguridad. Misma protección en la aparición escalonada, cuyo estado
  inicial es `opacity: 0` y habría dejado la pantalla en blanco.
- Cuentas y Créditos: las dos stat-cards heredaban la grilla de cuatro
  columnas y quedaban del ancho de un cuarto (`.kpis--dos`). Pagos fijos: las
  tres columnas quedan parejas (4/4/4 en vez de 5/4/3), que era lo que
  cortaba "Crédito de vehículo".

Bundle contra el commit inicial: inicial 296.23 → 299.37 kB transferidos,
`main` 641.83 → 640.54 kB en crudo (menos, por retirar `@angular/animations`),
ApexCharts fuera del bundle inicial. 146 pruebas.

### Tres cosas entre las fases y la reorganización (2026-09-23)

- **`208d50d` — el aviso nombra el pago:** pulsar "Pagar" en Pagos fijos
  mostraba "Gasto registrado". Quien pulsa "Pagar" no fue a registrar un
  gasto, fue a saldar el arriendo. Ahora dice "Pago de Arriendo registrado".
  `MovimientoFormData` gana `nombrePagoFijo` y el mensaje se arma dentro del
  formulario, en el único punto por donde ya pasaban los cuatro cierres con
  éxito; la alternativa (que `NuevoMovimientoService.abrir()` devolviera el
  resultado) cambiaba la firma de un servicio que usan cinco pantallas y
  dejaba dos avisos encimados. El nombre va aparte de `descripcion` porque esa
  es editable. **Quedó sin verificar en navegador** (la extensión de Chrome se
  desconectó): falta el click-through.
- **`312c14f` — el snack bar salía de la paleta de Material,** no del sistema
  de diseño: azure le daba un gris violáceo (#e3e2e6 sobre #2f3033) ajeno a
  los neutros fríos. Hueco del mapeo de la fase 1, que cubrió botones, FAB,
  pestañas, diálogo y hoja inferior pero no este. Tokens nuevos
  `--bg-inverse`, `--text-on-inverse` y `--accent-on-inverse`, uno por tema,
  manteniendo a propósito el contraste invertido que Material 3 usa para los
  avisos transitorios — uno que se ve igual que una tarjeta se pierde entre el
  contenido — pero tomado de la rampa propia.
- **`4be260d` — la tasa vigente faltaba en General y en Pagos fijos.** Este no
  es visual: General mostraba una "Deuda total" distinta de la de Créditos
  (57.022.464 contra 57.264.836). `tasaEaVigente` cae a la tasa base del
  crédito cuando no recibe el historial (`vigentes[0]?.tasaEa ?? credito.tasaEa`)
  sin fallar ni avisar, así que con un crédito de tasa variable (19,5% base,
  21,2% vigente) toda la amortización sale corrida. Eran dos defectos:
  General no pedía `listarCambiosTasa` en absoluto, y `ContextoPagosFijosMes`
  ni siquiera tenía campo `cambiosTasa`, así que la cuota salía 1.206.420 en
  vez de 1.241.805 y el error llegaba hasta el héroe de General. El bloque de
  carga se extrae a `core/api/creditos/cambios-tasa.util.ts` y lo usan las
  tres pantallas: **tener tres copias era el origen del bug** — solo una la
  tenía, y el fallback silencioso hacía que las otras dos no se quejaran.
  Prueba de regresión en `pagos-fijos-agrupados.spec.ts`.

### Reorganización del mock — 7 bloques (2026-09-23, 18:45 → 19:40)

Segunda tanda, con una restricción explícita en cada commit: **solo
estructura, ni tokens, ni paleta, ni tipografía.** Reorganiza lo que ya
existía según un mock nuevo, pantalla por pantalla.

| #   | Commit    | Qué reorganiza                                              |
| --- | --------- | ----------------------------------------------------------- |
| 1   | `074e64f` | Nav de escritorio con pastillas y menú de cuenta            |
| 2   | `9775362` | Cabecera de pantalla en escritorio (`app-page-head`)        |
| 3   | `5094340` | General: el mes como título, ritmo 60/40                    |
| 4   | `2e699db` | General: columnas de verdad (`.col-apilada`)                |
| 5   | `70a7498` | Cuentas: total, reparto y dos columnas                      |
| 6   | `63ed01e` | Créditos: encabezado de deuda y pago desde la tarjeta       |
| 7   | `65aeeab` | Movimientos: saldo por día · Pagos fijos: aviso de vencidos |

- **Nav:** las cinco secciones pasan de `mat-tab-nav-bar` a pastillas propias
  con el mismo ícono que ya usaba la barra inferior de móvil, así que la app
  se lee igual en los dos tamaños; de paso desaparece la paginación de
  Material, que entre 768 y 1023px escondía "Pagos fijos" detrás de una
  flecha. El "···" pasa a avatar con la inicial del correo y desplegable, con
  el tema como segmentado Claro/Oscuro (antes era un ítem que alternaba, y no
  se sabía cuál estaba activo sin leerlo al revés). `AuthService` gana un
  `email` de solo lectura. Degradación en dos pasos: bajo 1100px se va el
  rótulo de la marca y el texto de "Nuevo movimiento", bajo 900px el nav se
  queda en íconos con el nombre en `aria-label`.
  **Hallazgo de método, y vale para el futuro:** `scrollWidth` era ciego a
  este problema — el nav desborda su propia caja sin ensanchar el documento,
  así que la comprobación de desborde usada en la fase 5 no lo veía. Ahora se
  mide colisión entre elementos de la barra. Bundle: `main` 640.54 → 613.11 kB
  en crudo por quitar Material Tabs.
- **Cabecera:** `app-page-head` (título + detalle + acciones proyectadas) en
  Cuentas, Créditos, Movimientos y Pagos fijos, con un conteo real por
  pantalla ("4 cuentas activas · 2 bolsillos"). Se retira la utilidad
  `.solo-escritorio`, que existía porque esas acciones se duplicaban entre el
  contenido y el header móvil. **No se dibuja por debajo de 768px:** en móvil
  el header ya trae el nombre de la pantalla y su acción. Al ocultarla, casi
  se pierde el selector de mes de Movimientos y Pagos fijos, que estaba
  proyectado dentro — ahora vive en su propia fila, visible en los dos
  tamaños.
- **General:** el mes pasa a ser el título ("Septiembre de 2026"), que es lo
  que corresponde porque la pantalla siempre muestra el mes en curso y no hay
  selector que poner. El héroe absorbe sus tres cifras de apoyo en vez de
  dejarlas como pares sueltos, y "Próximos pagos" sube a su lado porque es lo
  que el monto no explica por sí solo. La izquierda apila Ingresos vs gastos,
  Últimos movimientos y Cuotas que faltan; la dona va sola a la derecha,
  libre de crecer sin arrastrar al vecino. **El DOM sigue el orden de móvil** y
  escritorio reordena con `order`: el orden solo puede coincidir con uno de
  los dos tamaños, y móvil es donde más pesa. `formatearDiaSemana` nuevo en
  `shared/format/fecha.ts`.
- **Cuentas:** las dos stat-cards sueltas (Disponible / Reservado) se funden
  en un héroe con el total y una barra de dos tramos — lo que importa de esas
  dos cifras es la proporción, y dos tarjetas lado a lado obligan a restar
  mentalmente. El total no es un dato nuevo, es la suma de los dos que ya
  estaban. Panel "Dónde está tu dinero" a la derecha, con un decimal solo por
  debajo del 10% porque "0,5%" dice algo y "88,5%" no más que "88%".
  `.bar--segmentos` reparte el ancho con `flex-basis`, no con el `scaleX` de
  `--progreso` que usa la barra de un solo valor.
- **Créditos:** héroe con "cuánto debo", "cuánto sale este mes" y "cuándo es
  lo próximo", que son tres preguntas que se hacen juntas. Cada tarjeta gana
  un pie con la cuota que viene y un botón "Registrar pago" — el mismo
  movimiento que hace "Pagar" en Pagos fijos, pero sin salir de donde se está
  mirando la deuda. Corrección de exactitud: etiquetar como "Próxima cuota"
  la fecha más cercana mostraba una ya vencida; ahora toma la primera que no
  ha pasado, y si todas vencieron muestra "Cuota vencida" en rojo.
- **Movimientos y Pagos fijos:** buscador, chips y "Más filtros" a un mismo
  contenedor. Cada grupo de día muestra su saldo neto reusando
  `resumenMovimientos` sobre los movimientos del día, así que aplica la misma
  regla que el resumen del mes — transferencias, internos y ajustes no
  cuentan, porque mover plata entre cuentas propias no cambia el saldo del
  día. El héroe de Pagos fijos avisa cuántos pagos vencieron sin pagarse
  (antes había que recorrer la lista contando píldoras rojas) y cada fila por
  pagar gana un sello con el día y el mes, del ancho de un ícono de fila para
  que la columna izquierda quede alineada con las listas que sí llevan ícono.

Cada bloque se verificó en 360, 768 y 1440 sin desborde, contraste AA en los
dos temas, 147 pruebas pasando.

### Fuera de alcance, acordado

Lo que el mock pide y **no** se construyó, por decisión explícita — está acá
para que no se busque como si faltara por olvido:

- **Pantallas y funciones nuevas:** búsqueda global, Ajustes, Categorías,
  Exportar datos y el onboarding "Configura tu mes".
- **Cálculos nuevos** (no son reorganización): gasto diario disponible, la
  píldora "Vas bien", el avance del mes, la proyección, las "Próximas
  cuotas" y la fecha de liberación de deuda ("quedas libre de deudas en
  \<mes\>"). Por eso Créditos mantiene el héroe a ancho completo en vez del
  60/40 del mock, que llenaba su columna derecha justo con eso.
- **"Has pagado X (17%) de Y en total"** no se puede construir con los datos
  que hay: solo BANCO y PERSONA tienen `monto` original; TARJETA y
  PLATAFORMA tienen `cupo`, que es un límite, no una deuda. Sumarlos daría un
  denominador inventado.
- **"Acciones rápidas" en Cuentas:** en el mock son accesos sueltos, pero acá
  esas acciones necesitan saber sobre qué cuenta actúan, y esa elección no
  existe todavía.

### Pendientes al cierre de la tanda

1. ~~Los 7 bloques de la reorganización no están desplegados.~~ **Resuelto el
   2026-09-26 (00:19).** Durante dos días lo vivo fue el commit `4be260d` de
   las 17:48 del 23: el último `firebase deploy` era de las 18:02 de ese día y
   todo lo de 18:45 en adelante se quedó en local. Había un `dist/` construido
   a las 19:40, el mismo minuto del último commit — se hizo el build y la
   sesión se cortó antes del deploy. Ya está desplegado y verificado: el cache
   de hosting y `dist/` sirven el mismo `main-*.js`. Esa comparación es la
   forma rápida de responder "¿lo vivo es lo último?" sin abrir el navegador.
2. **Falta el click-through del aviso "Pago de X registrado"** (`208d50d`), lo
   único que quedó sin verificar en navegador.
3. **Pregunta abierta sin responder:** el mock repite "Reservado" en el héroe
   de General y en las stat-cards. Se respetó tal cual; queda decidir si se
   quita de un sitio.
4. **El repositorio no tiene remote.** Todo este trabajo vive en un solo
   disco.
5. **`shell.scss` pasó el presupuesto de estilos de componente.** El build de
   este deploy avisa 4.80 kB contra el máximo de 4 kB (`anyComponentStyle` en
   `angular.json`; el error está en 8 kB, así que no rompe nada todavía). La
   fuente creció de 7.9 a 9.5 kB en la tanda de reorganización, que es donde el
   nav de escritorio y el menú de cuenta se escribieron ahí — y es justo la
   regla que la fase 1 citaba para mantener los patrones en
   `_componentes.scss`.

## Corrección — Hosting cacheaba index.html y ngsw.json una hora (2026-09-26)

Reportado: "no se desplegó nada", justo después de un deploy que sí había
salido. Antes de tocar nada se comprobó por tres vías que el deploy estaba
bien: el registro del canal `live` de Firebase
(`firebase hosting:channel:list`), el `main-*.js` que sirve el CDN, y la
presencia de cadenas del rediseño ("Cuenta personal", "Dónde está tu dinero")
dentro de los bundles descargados del sitio vivo.

**Causa:** `firebase.json` no declaraba `headers`, así que Hosting aplicaba su
default `Cache-Control: max-age=3600` a **todo**, incluidos `index.html`,
`ngsw.json` y `ngsw-worker.js`. Durante una hora después de cada deploy el
navegador seguía sirviendo el `index.html` viejo desde su propia caché. Y lo
peor: el service worker comprueba si hay versión nueva pidiendo `ngsw.json`,
que también le llegaba cacheado, así que concluía que no había nada nuevo.

Es la segunda mitad del problema del 2026-09-22 ("el service worker dejaba la
app vieja cacheada tras cada deploy", más arriba). Entonces se arregló **qué
hace** la app cuando detecta una versión nueva; faltaba que **pudiera
detectarla**. El auto-recargo por `VERSION_READY` no puede dispararse si el
manifiesto que lo detonaría viene de la caché.

**Corrección:** bloque `headers` en `firebase.json` con `no-cache` para `/`,
`**/*.html`, `/ngsw.json` y `/ngsw-worker.js`. `no-cache` no significa "no
guardes", significa "revalida antes de usar", que es exactamente lo que se
quiere en esos cuatro. Los bundles con hash en el nombre se quedan con el
default de una hora a propósito: su contenido no puede cambiar sin que cambie
el nombre del archivo, así que ahí la caché nunca sirve algo viejo. (Mejora
posible, no aplicada: subirlos a `max-age=31536000, immutable`.)

Verificado con `curl -I` contra el sitio vivo: los cuatro responden
`no-cache` y `main-*.js` conserva `max-age=3600`. La regla `/` es necesaria
aparte de `**/*.html` porque la petición a la raíz llega como `/` y el
`rewrite` a `/index.html` ocurre después de resolver los headers.

**Por única vez, otra vez:** el arreglo viaja dentro del deploy que hay que ir
a buscar, así que el `index.html` y el `ngsw.json` que un dispositivo ya tenga
guardados siguen bajo la regla vieja hasta que expiren (una hora) o se fuerce
una recarga: en escritorio Ctrl+Shift+R o una ventana privada; en la PWA del
celular, cerrarla del todo y volver a abrirla. De ahí en adelante cada deploy
se detecta al instante y la app se recarga sola.

## Pasada de impeccable (2026-10-15 → 2026-10-16)

Primera tanda con la skill **impeccable** (pbakaus/impeccable): `init` →
`critique` → `polish`. Cambia el norte del producto: la idea ahora es
**distribuir la app al público general en Colombia**, celular primero, para
gente sin conocimiento financiero. Eso quedó en `PRODUCT.md` (nuevo, lo lee
la skill), junto con lo intocable: registrar en segundos y el tuteo en
español de Colombia.

**Critique (21/40, "Aceptable")**, con dos evaluaciones aisladas (diseño y
detector + navegador); el snapshot está en `.impeccable/critique/`. Dijo que
el modelo es muy propio (bolsillos, Addi/Sistecrédito, tasa variable) pero
la capa visual es la plantilla genérica de fintech, y que para un usuario
nuevo fallaba justo en lo que `PRODUCT.md` define como éxito: confiar en los
números sin hacer cuentas mentales. Lo visual se mantuvo sobrio a propósito;
solo se quitó ruido.

| Prioridad | Qué                                   | Cómo quedó                                                                                                                                                                     |
| --------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0        | Los pagos fijos no se podían corregir | Tocar uno despliega Editar, **"Ya lo pagué"** (marca el periodo sin registrar gasto, con Deshacer) y Eliminar (lo desactiva, con confirmación en rojo)                         |
| P1        | Cifras que se contradecían            | "Por pagar este mes" ya no suma cuotas pagadas; el encabezado de Créditos nombra las vencidas; "Venció el…" en el pie; texto y barra de cuotas miden lo mismo                  |
| P1        | Registrar no cabía "en segundos"      | Pie fijo con "Registrar", monto con `$` y puntos de miles, última cuenta recordada, descripción opcional, tocar fuera ya no borra lo escrito                                   |
| P1        | Jerga                                 | "Tasa efectiva anual" con ayuda, "¿Qué quieres corregir?" en vez de "Pieza", interruptores que explican qué cambia, errores específicos en vez de "Este campo es obligatorio." |
| P2        | Todo pedía atención a la vez          | Sin franjas laterales de color; "Registrar pago" en relleno solo si urge; "Reservado" ya no se repite en General                                                               |

**Línea de tiempo del mes** (pedida explícitamente): "¿Qué
tengo que pagar y cuándo?" deja de ser otra lista. Pagos fijos pasa de dos
columnas (Por pagar / Pagados) a un solo eje con los pagos colgados de su
día de vencimiento y **Hoy** marcado; General muestra la franja del mes con
hoy, una marca por día y el resumen en texto ("8 vencidos · 3 esta semana").
La lógica es `core/domain/linea-del-mes.ts`, pura y con pruebas.

Decisiones que no son obvias:

- **"Ya lo pagué" no crea movimiento.** Es para quien empieza a usar la app a
  mitad de mes: su saldo inicial ya descuenta esos pagos, y registrarlos con
  "Pagar" los contaría dos veces. Se guarda en
  `PagoFijo.periodosPagadosSinMovimiento`; si además hay un movimiento,
  manda el movimiento. No toca las reglas de Firestore (`usuarios/{uid}/**`).
- **Eliminar un pago fijo es `activo: false`**, no borrar el documento: los
  movimientos que ya lo pagaron siguen apuntando a él.
- **La última cuenta usada vive en `localStorage`** del dispositivo: es una
  comodidad, no un dato. Sin almacenamiento, el campo queda vacío como antes.
- **El monto es `type="text"` con `inputmode="numeric"`** (`shared/forms/monto-input.ts`):
  `type="number"` no admite los puntos de miles. El control sigue guardando
  un número.
- **Títulos de panel de h3 a h2** y h1 en el header móvil: el detector marcaba
  el salto h1 → h3, y en móvil no había h1.

Verificado en 390 y 1440 px con datos de prueba: el flujo completo del
formulario (formato del monto, foco al primer error, tocar fuera, cuenta
recordada) y "Ya lo pagué" → aviso con Deshacer → Editar. 155 pruebas. El
detector de impeccable queda en 0 hallazgos. Los dos avisos de presupuesto del
build (bundle inicial 1,21 MB y `shell.scss` 4,80 kB) ya estaban antes de
esta tanda.

Pendientes que deja:

1. ~~**Desplegar**~~ — hecho el 2026-10-15 con `npm run deploy`. Verificado
   contra el sitio vivo: sirve el mismo `main-*.js` que `dist/` y el chunk de
   Pagos fijos es idéntico al local. El primer intento falló con
   `resolving hosting target of a site with no site name`: era la sesión del
   CLI vencida (401), no la configuración; se arregla con
   `firebase login --reauth`.
2. El `aria-label` de la gráfica de tendencia lo pone ApexCharts en inglés.
3. Los dos "+" (el del header crea cuenta/crédito/pago fijo, el FAB crea
   movimiento) siguen conviviendo en Cuentas, Créditos y Pagos fijos.
4. Lo que el critique dejó fuera por ser producto nuevo: ~~registro de
   usuarios~~ (hecho con Google, ver la sección siguiente), primer uso /
   onboarding, y una ayuda contextual más amplia.

## Login con Google y registro abierto (2026-10-15)

Va con el norte de `PRODUCT.md` (la app para el público general): cualquiera
con cuenta de Google crea su cuenta al entrar. Los datos ya estaban separados
por usuario desde la migración a Firebase (`usuarios/{uid}/...` y una regla
por dueño), así que no hubo que migrar datos ni cambiar la lógica de las
reglas — en `firestore.rules` solo cambió el comentario.

- **`AuthService`:** `entrarConGoogle()` entra o crea la cuenta (Firebase no
  distingue los dos casos) y `vincularGoogle()` une Google a una cuenta de
  correo y contraseña: mismo uid, mismos datos. Va por ventana emergente en
  el navegador y por redirección en la app instalada (`display-mode:
standalone` o `navigator.standalone`), donde en iPhone la ventana
  emergente no siempre vuelve; también por redirección si el navegador
  bloquea la ventana. Lo que vuelve de una redirección se recoge con
  `getRedirectResult` al arrancar.
- **Login:** "Continuar con Google" es la entrada; correo y contraseña
  quedan detrás de "Entrar con correo y contraseña", solo para las cuentas
  creadas a mano antes. Los errores de Google salen junto a su botón
  (`auth-errores.ts`); cerrar la ventana de Google no cuenta como error.
- **Menú de cuenta:** "Vincular con Google" mientras la cuenta no lo tenga;
  el resultado sale en un snackbar.
- **`authDomain` = `app-finanzas-4dd88.web.app`** en producción (antes el
  `firebaseapp.com` por defecto): la redirección necesita que el dominio de
  auth sea el mismo de la app en los navegadores que aíslan el
  almacenamiento de terceros. En desarrollo se queda el por defecto.

**Antes de desplegar** (consola, no código):

1. Firebase → Authentication → Sign-in method → **Google** → Habilitar, con
   nombre público y correo de asistencia (salen en la pantalla de Google).
2. Google Cloud → APIs y servicios → Credenciales → el cliente OAuth "Web
   client (auto created by Google Service)" → URI de redireccionamiento
   autorizados → agregar `https://app-finanzas-4dd88.web.app/__/auth/handler`.
   Sin esto Google responde `redirect_uri_mismatch`, también con la ventana
   emergente, porque usa el mismo `authDomain`.

Después del despliegue, la cuenta de correo y contraseña de siempre entra
como antes y usa "Vincular con Google" **antes** de entrar con Google
directo: si el correo de Google no es el mismo de la cuenta, entrar directo
crea un usuario nuevo y vacío.

**Pendientes:** primer uso / onboarding (un usuario nuevo arranca con las
pantallas vacías); vigilar la cuota de Firestore ahora que cualquiera puede
registrarse (en el plan gratis, si se llena el límite diario se corta para
todos hasta el día siguiente); política de privacidad si la app se
distribuye en serio.

## Toque elegante (2026-10-15)

Pasada visual pedida como "darle un toque elegante" y con esqueletos para la
precarga. Se tomaron como guía cuatro skills externas, leídas desde sus
repositorios sin instalarlas: **Taste** (leonxlnx/taste-skill, la variante
para rediseñar una app existente), **UI UX Pro Max**
(nextlevelbuilder/ui-ux-pro-max-skill, sus filas de finanzas y su lista de
estados de carga), **Humanizer** (blader/humanizer, para los textos) y el
formato **DESIGN.md** de Google Labs, con dos ejemplos de awesome-design-md
(Mercury y Stripe). Más la skill frontend-design, que sí está instalada. El
resultado quedó documentado en `DESIGN.md`, en ese formato.

- **Tipografía:** Hanken Grotesk en vez de Inter, comparada en el navegador
  contra Geist, Schibsted Grotesk, Instrument Sans, Onest, Figtree y Host
  Grotesk con montos reales. Ganó por sus cifras tabulares: en Schibsted y
  Onest los puntos de miles se abren ("2 . 345 . 678"). La cifra héroe
  baja a peso 300 y su "$" va más chico y alzado (`.amount__moneda`; el
  monto sigue leyéndose "$1.250.000" como texto).
- **Acento azul tinta:** `#2f4b9a` en claro y `#8ea6f0` en oscuro, en vez
  de `#1d5fd6` / `#5b97ff`. `npm run verificar:contraste` pasa en los dos
  temas.
- **Textura de billete** en la tarjeta héroe de cada pantalla: líneas
  guilloché en `public/textura-billete.svg`, usadas como máscara con el
  color del acento, en una franja fija arriba a la derecha. Es el único
  adorno.
- **Esqueletos de carga:** `primeraCarga()` (`shared/carga/`) dice cuándo
  llegó todo lo que pinta una pantalla. Hasta entonces, `<app-amount
[cargando]>` y `<app-stat-card [cargando]>` muestran un bloque del tamaño
  del monto, las listas usan `app-skeleton-rows`, las gráficas reservan su
  alto, los conteos del encabezado ("0 cuentas activas", "0%") no se
  muestran y la pantalla lleva `aria-busy`. Antes solo General tenía
  esqueletos en dos listas; el resto pintaba $0 y estados vacíos durante
  el primer segundo contra Firestore. Si una fuente falla, se da por
  cargada para no dejar esqueletos para siempre.
- **Textos (Humanizer):** sin rayas en los textos de la interfaz, "Hoy, 15
  de octubre" en vez de "Hoy · 15 de octubre", "Vence el" en vez de
  "Próxima ·", "Sin ingresos ni gastos este mes" en vez de "Sin datos del
  mes" y "Google quedó vinculado a tu cuenta" en vez de "Listo: ya puedes
  entrar con Google".

Verificado en el navegador con los datos de ejemplo, en claro y oscuro, a
375px y 1280px, con los esqueletos forzados con una demora temporal en el
mock (ya quitada).

### Login más profesional (2026-10-15)

- Dos zonas: panel de marca (`--bg-marca`, igual en los dos temas) con el
  nombre "Nexus Finanzas", un lema que se escribe solo y, en escritorio,
  las otras tres preguntas que responde la app; al lado, una tarjeta de
  acceso con correo y contraseña a la vista, "Entrar", y debajo
  "Continuar con Google" y una nota de que la app no se conecta al banco.
  En el celular el panel se encoge a una franja arriba.
- La textura de billete crece en el panel, siempre lejos del texto.
- Los pares de color del panel entraron a `npm run verificar:contraste`.

### Tema de Mi Semana (2026-10-19)

Finanzas y Mi Semana (`app-mi-semana/mi_semana-front`) son de la misma casa
y ahora se ven igual. Solo cambió lo visual: ninguna pantalla ganó ni perdió
funciones, y la navegación son los mismos cinco enlaces.

- **Paleta:** el teal y los grises fríos de `mi_semana/static/styles/tokens.css`,
  en claro y oscuro, en `_primitivas.scss`. Lo que Finanzas necesita y Mi
  Semana no tiene (un tercer nivel de texto, el borde de campo a 3:1, los
  fondos de badge de cada monto) se derivó de esa rampa. El contraste AA
  sigue pasando en los dos temas, con pares nuevos para diálogos y campos.
- **Tipografía:** Plus Jakarta Sans (peso base 500) y Anton para la marca y
  los títulos, en mayúsculas. Las dos se sirven desde `public/fonts`
  (copiadas de Mi Semana, licencia OFL) en vez de Google Fonts. Cifras en
  800; rótulos de indicador y encabezados de panel en mayúsculas.
- **Formas:** tarjetas y paneles de 20px, barra lateral y diálogos de 28px,
  campos de 12px, botones y chips en píldora. La acción principal lleva el
  halo teal de Mi Semana.
- **Escritorio:** cabezote con "FINANZAS" en Anton y las acciones, barra
  lateral flotante con las secciones (la activa rellena de teal; entre 768
  y 1023px solo íconos) y una cabecera de pantalla con sello de ícono y
  título en Anton, como la cabecera de categoría de Mi Semana.
- **Móvil:** misma estructura de antes (header, barra inferior, botón
  flotante) con la paleta y el título de la pantalla en Anton.
- **Login:** conserva su diseño y sus formas; solo tomó los colores (panel
  en teal profundo, línea y botón en teal). Los blancos y rojos que tenía
  escritos a mano pasaron a tokens, con lo que en tema oscuro la tarjeta
  ya no sale blanca con texto claro.
- El menú de la cuenta tenía la cabecera y la fila de tema sin estilos;
  ahora los tiene.

Verificado en el navegador con los datos de ejemplo: las cinco pantallas,
un diálogo y el menú de cuenta, en claro y oscuro, a 375, 820 y 1440px.

## Sistema de diseño (2026-09-11)

Fuente: `../app-finanzas.prototipo/` (prototipo del diseñador — `tokens.css`,
`app.css`, `prototipo.html`, `tokens.html`). Portado a:

- `src/styles/tokens/_primitivas.scss` — paleta en hex, capa 1.
- `src/styles/tokens/_semanticos.scss` — tokens semánticos + alias por tipo
  de movimiento, capa 2. Claro en `:root`; oscuro sigue
  `prefers-color-scheme` (mixin `tokens-oscuro`, reutilizado en
  `body.dark-theme` para cuando exista un selector manual — todavía no
  tiene control en la interfaz, como piden las notas).
- `src/styles/tokens/_material.scss` — capa 3: mapea los semánticos al tema
  de Material M3 (`mat.theme()` + `--mat-sys-*` como red de seguridad, más
  overrides específicos de `mat.button-overrides`, `mat.fab-overrides`,
  `mat.tabs-overrides`, `mat.dialog-overrides`, `mat.bottom-sheet-overrides`,
  `mat.icon-button-overrides`).
- `src/styles/_componentes.scss` — clases globales portadas de `app.css`
  (`.btn`, `.card`, `.panel`, `.kpi`, `.row`, `.badge`/`.sem-*`, `.bar`,
  `.chip`, `.field`/`.input`, `.seg`, `.switch`, `.empty`, `.cols-2/3`,
  tipografía `.t-meta/.t-sec/.t-row/.t-kpi/.t-hero/.screen-title`). Se usan
  directamente en las plantillas junto a los componentes de Material.
- `src/index.html` — fuente Inter + Material Symbols Outlined (`opsz 20..24`,
  igual que el prototipo).
- Shell restyled para calzar con el prototipo: topbar con marca + tabs +
  botón de ocultar montos + "Nuevo movimiento" en escritorio; topbar mínimo
  (título de la pantalla + ojo) + barra inferior + FAB en móvil.
- `src/app/core/montos-visibility.service.ts` — signal global de "ocultar
  montos" (botón vive en el shell porque aplica a todas las tabs, no solo
  General). El componente compartido `amount` (fase 3+) lo va a consultar.

**Bug real encontrado y corregido:** `<mat-icon [fontIcon]="x">` no sirve
para fuentes de ligadura como Material Symbols (ese input es para fuentes
con una clase CSS por ícono). La forma correcta es pasar el nombre como
contenido: `<mat-icon>{{ x }}</mat-icon>`. Verificado visualmente con
capturas de pantalla (Playwright + Edge del sistema) en escritorio, móvil,
claro y oscuro — sin esto los íconos no se veían en ningún lado.

## Fase 3 — Formulario de movimiento (2026-09-11)

`src/app/movimiento-form/` (`movimiento-form.ts/.html/.scss` +
`movimiento-form-data.ts`), calcado del formulario del prototipo
(`prototipo.html`, sección "Formulario de movimiento"):

- Selector segmentado gasto/ingreso/transferencia (`.seg`), monto y fecha,
  y los campos propios de cada tipo aparecen/desaparecen con `@if` (sin
  `data-if` + CSS como en el prototipo estático: acá los controla
  directamente el signal `tipo()`).
- "Pagar con" (gasto) y "Hacia" (transferencia) agrupan cuentas/bolsillos,
  tarjetas y plataformas/créditos vía nuevas funciones puras en
  `core/domain/opciones-cuenta.ts` (`gruposPagarCon`, `gruposTransferenciaHacia`,
  `opcionesCuentasYBolsillos`), con pruebas.
- Cuotas (1-48) solo si "Pagar con" es tarjeta o plataforma; valor de cada
  cuota editable solo en plataforma, "Cuota aproximada" de solo lectura
  (monto / cuotas) en tarjeta.
- Validaciones: monto > 0, descripción obligatoria en gasto/ingreso, cuotas
  1-48, monto contra el cupo disponible de la tarjeta (usa `deudaCredito` de
  `core/domain`), origen ≠ destino y saldo suficiente en transferencias
  internas (`core/domain/clasificacion-movimiento.ts`, nuevo: `esInterno`,
  `descripcionAutomaticaTransferencia`).
- Texto de ayuda dinámico según el caso (igual a los ejemplos del prompt:
  "Pago de crédito: baja la deuda, no cuenta como gasto.", etc.).
- Recibe `MovimientoFormData` opcional: tipo/origen/destino preseleccionados
  (atajo "Agregar compra", botón "Pagar" de un pago fijo — fases 5 y 6) y
  `movimiento` para editar (fase 7); en modo edición actualiza en vez de
  crear, y si el gasto vino de una compra a cuotas, la actualiza también
  (se agregó `actualizar` a `ComprasApi`).
- `NuevoMovimientoService.abrir()` ahora abre `MovimientoForm` (reemplaza el
  placeholder de la fase 2, que se eliminó) y acepta `MovimientoFormData`.
- Nuevo pipe compartido `shared/pipes/moneda-cop.pipe.ts` (+
  `shared/format/moneda.ts` con la función pura `formatearCop`, reutilizada
  también dentro del componente para armar mensajes de error) — primer
  componente de `shared/` que se necesitó de verdad.
- **Ajuste sobre `Intl.NumberFormat('es-CO', ...)`:** mete un espacio (a
  veces non-breaking) entre "$" y el número; se quita para que quede
  `$1.250.000`como pide el prompt, no`$ 1.250.000`.
- Verificado visualmente (Playwright + Edge del sistema): las 3 pestañas,
  aparición/desaparición de cuotas al elegir tarjeta, errores de validación
  en pantalla, y el mismo componente en `MatDialog` (escritorio) y
  `MatBottomSheet` (móvil).

### Ajustes visuales sobre el modal (2026-09-11, feedback directo)

- **Faltaba `* { box-sizing: border-box }`** (lo tenía `app.css` del
  prototipo, se me quedó fuera al portarlo a `styles.scss`): sin eso, cada
  `.input`/`.btn` con `width:100%` + padding + borde se pintaba más ancho
  que su contenedor. Sumado a que `.form-2` y `.seg` usaban `1fr` en vez de
  `minmax(0, 1fr)` en el grid, un `<select>` con texto largo ("Elige una
  cuenta, tarjeta o plataforma") desbordaba el modal — pasaba en móvil y en
  escritorio. Las dos cosas están corregidas en `styles.scss` y
  `styles/_componentes.scss`.
- **`.form-2` no tenía estilo base para móvil:** solo estaba definido
  dentro de `@media (min-width: 768px)` (donde pasa a grid de 2 columnas).
  Por debajo de ese ancho quedaba como un `div` sin `gap`, así que "Fecha"
  se veía pegado al campo de "Monto". Se agregó una base
  `display:flex; flex-direction:column; gap:var(--space-4)` fuera del
  media query.
- Modal de escritorio más ancho (650px) y con más espacio entre campos
  (`gap: var(--space-6)` en el `form`), y el texto de ayuda con un divider
  (`border-bottom`) justo debajo, separando la sección de tipo/ayuda de los
  campos — cambios del usuario directamente en el código, que se
  respetaron; el divider se agregó encima de esos cambios.

## Fase 4 — Cuentas (2026-09-11)

Calcada de la sección "Cuentas" del prototipo (`prototipo.html`, `#s-cuentas`
y su `<style>` inline, que tenía clases —`.hd`, `.group-head`, `.stack`,
`.detalle`, `.kv`, `.ico`— que no se habían portado a `_componentes.scss`
en la fase del sistema de diseño; se agregaron ahí, junto con las clases
que sí estaban).

- **`core/domain/cuentas-agrupadas.ts`** (nuevo, con pruebas): agrupa
  cuentas raíz por tipo en el orden fijo del prototipo (Banco, Billetera
  digital, Efectivo, Otro), con saldo libre/total y bolsillos ya
  calculados; los grupos vacíos se devuelven igual para poder mostrar su
  estado vacío.
- **`cuentas.page.ts/html/scss`**: KPIs de disponible/reservado arriba,
  grupos con subtotal (oculto si el grupo está vacío), panel por grupo con
  las cuentas del tipo. Cada cuenta es expandible (saldo libre, bolsillos
  con badge "Reservado" si aplica, y los chips de acción), igual al patrón
  que el prototipo solo mostraba completo para Bancolombia.
- **Shared nuevos, primer uso real:**
  - `shared/amount`: envuelve cualquier monto para que respete el botón
    global de "ocultar montos" (hasta ahora nada lo consultaba). El host
    reemplaza al `<span>`/`<b class="amt">` del prototipo: el tamaño/color
    se sigue poniendo desde afuera con clases (`t-kpi`, `.kv b`...).
  - `shared/empty-state`: bloque `.empty` con título, descripción opcional
    y una acción proyectada por `<ng-content>`. Usado en el grupo "Otro".
  - `shared/confirm-dialog`: confirmación genérica por `MatDialog`
    (`{titulo, mensaje, textoConfirmar?}` → `true`/`false`), pensada para
    reusarse en "Archivar" de fases futuras (Créditos, Pagos fijos...).
- **Acciones sobre una cuenta** (notas funcionales, "Acciones sobre una
  cuenta"):
  - **Mover dinero:** no es un formulario nuevo — reutiliza
    `NuevoMovimientoService.abrir({ tipo: 'transferencia', cuentaOrigenId })`
    con el origen preseleccionado. `MovimientoForm` (fase 3) ya clasificaba
    estos movimientos como `INTERNO` automáticamente (`esInterno`) cuando
    origen y destino son piezas de la misma cuenta raíz.
  - **Agregar bolsillo** (`bolsillo-form/`): el bolsillo se crea en $0 y,
    si hay monto inicial, se registra un movimiento `INTERNO` madre →
    bolsillo — así el total de la cuenta no cambia (regla de las notas) y
    queda en el historial. Valida que el monto no supere el saldo libre
    disponible de la madre.
  - **Ajustar saldo** (`ajustar-saldo-form/`): elige la pieza (saldo libre
    o un bolsillo puntual), pide el saldo real y registra un movimiento
    `AJUSTE` por la diferencia (origen si baja, destino si sube). Si la
    diferencia es cero, no crea nada.
  - **Agregar cuenta / Editar** (`cuenta-form/`): mismo componente en los
    dos modos. El saldo inicial solo se pide al crear — en edición se
    oculta con una nota, porque el total nunca se edita a mano.
  - **Archivar:** `ConfirmDialog` + `CuentasApi.archivar`.
- Verificado visualmente (Playwright + Edge del sistema): escritorio y
  móvil (390px, oscuro), grupo colapsado/expandido, cuenta con bolsillos
  (Bancolombia) y sin bolsillos (Nequi) — ambas expanden con el mismo
  patrón y todos sus chips —, los 5 diálogos de acción, y "Mover dinero"
  abriendo `MovimientoForm` con "Desde" preseleccionado. Sin overflow en
  ningún ancho.
- 80 pruebas unitarias en total (76 + 4 de `cuentas-agrupadas`).

## Fase 5 — Créditos (2026-09-11)

Calcada de la sección "Créditos" del prototipo (`prototipo.html`, `#s-creditos`
y su `<style>` inline: `.credito`, `.hd`, `.stack`, `.detalle`, `.kv`, ya
usadas en fase 4, más `.credito.v/.a/.r/.p` que no se habían portado — se
agregaron a `_componentes.scss` como `.credito--verde/--amarillo/--rojo/--pagado`,
nombradas por el estado en vez de la letra suelta del prototipo).

- **`core/domain/creditos.ts` (ampliado):** dos funciones nuevas, con
  pruebas.
  - `estadoPagoCredito(credito, movimientos, hoy)`: próxima fecha límite y
    si ya se pagó este mes (hay un movimiento con `creditoDestinoId` este
    mes). Si ya se pagó, la fecha límite pasa al mes siguiente — literal de
    las notas ("al registrar el pago del mes, la fecha pasa al mes
    siguiente"). `null` en personas, que no tienen cuota fija.
  - `cuotaMensual(credito, contexto)`: cuánto toca pagar este mes según el
    grupo — tarjeta usa el extracto del periodo si ya llegó, si no la suma
    de cuotas de sus compras (igual que plataforma); banco usa la cuota de
    la tabla de amortización que sigue; persona no aplica.
  - `cuotasPagadasBanco` pasó de privada a exportada (la necesita la
    pantalla para la barra de progreso y la fila "Próxima cuota").
- **`core/domain/creditos-agrupados.ts`** (nuevo, con pruebas):
  `agruparCreditosPorTipo` — créditos sin archivar agrupados por tipo en el
  orden del prototipo (Tarjetas, Bancos, Plataformas, Personas), cada uno
  con deuda/cuota/cuotas faltantes/estado de pago ya calculados y
  ordenados por fecha límite más cercana dentro de su grupo. A diferencia
  de `agruparCuentasPorTipo` (fase 4), los grupos sin créditos no se
  devuelven: el prototipo no muestra un estado vacío para Créditos.
- **`shared/format/fecha.ts`** (nuevo): `formatearMesAnio` ("agosto de
  2027", para "Termina") y `formatearDiaMes` ("20 de agosto", igual a
  Movimientos en el prototipo, para los abonos de personas).
  **`shared/format/porcentaje.ts`** (nuevo): `formatearPorcentaje` para
  Tasa E.A./mensual ("22,95%") — a diferencia de la moneda, `Intl` no mete
  espacio acá, no hizo falta ningún ajuste.
- **`creditos.page.ts/html/scss`**: KPIs de deuda total y por pagar este
  mes arriba (igual al prototipo, que no muestra el contador de "N
  urgentes/M por vencer" que sí piden las notas en otra sección — el
  semáforo por tarjeta ya comunica la urgencia, así que no se agregó un
  KPI que el prototipo no tiene). Grupos con sus créditos expandibles
  (mismo patrón `.stack`/`.detalle` de Cuentas): tarjeta y plataforma
  muestran sus compras vigentes y "Agregar compra"; banco muestra tasa,
  seguro, fecha de término (hoy + cuotas que faltan) y la próxima cuota
  con su capital/interés, más una barra de progreso; persona muestra los
  abonos registrados y "Registrar abono".
  - **Extractos de tarjeta:** `CreditosApi.listarExtractos` es por
    crédito (como un endpoint anidado), así que se piden para cada
    tarjeta y se combinan en una lista plana (`combineLatest` +
    `toObservable`/`toSignal`), no hay un "listar todos" en la interfaz.
- **Sin formulario propio ni acciones de crear/editar/archivar el
  crédito:** "Agregar compra" reutiliza `MovimientoForm` en modo gasto con
  la tarjeta o plataforma preseleccionada (`creditoId`); "Registrar abono"
  lo reutiliza en modo transferencia con el crédito preseleccionado como
  "Hacia" (`cuentaDestinoId`, que el formulario ya aceptaba como id
  genérico de destino, no solo de cuenta). El prototipo no muestra botones
  de crear/editar/archivar crédito en esta pantalla (a diferencia de
  Cuentas, que sí los tenía explícitos), así que no se agregaron.
- Verificado visualmente (Playwright + Edge del sistema): escritorio y
  móvil (390px, oscuro), los 4 grupos con datos reales del mock (rojo,
  amarillo y verde presentes a la vez), tarjeta con y sin extracto del
  periodo, "Agregar compra" y "Registrar abono" abriendo `MovimientoForm`
  con el campo correcto preseleccionado y el texto de ayuda esperado. Sin
  overflow en ningún ancho.
- 91 pruebas unitarias en total (80 + 7 de `creditos` + 4 de
  `creditos-agrupados`).

## Fase 6 — Pagos fijos (2026-09-11)

Calcada de `#s-pagos` del prototipo: selector de mes, `.hero` con "Falta por
pagar" y su barra de progreso, dos `.panel` ("Por pagar"/"Pagados"). `.month`,
`.hero` y `.desglose` no estaban portadas a `_componentes.scss` todavía (solo
existían como estilo inline del prototipo) — se agregaron ahí.

- **Reactividad de los `*MockApi` (cross-cutting, no solo de esta fase):**
  hasta ahora `listar()` devolvía una foto fija (`of([...array])`) tomada una
  sola vez al abrir la pantalla; crear/editar algo en un diálogo (p. ej.
  "Pagar" aquí, o "Mover dinero"/"Agregar compra" en fases 4-5) no se veía
  reflejado hasta navegar a otra tab y volver. Se creó `core/api/list-store.ts`
  (`ListStore<T>`, un `BehaviorSubject` por recurso) y se migraron
  `CuentasMockApi`, `CreditosMockApi`, `ComprasMockApi`, `MovimientosMockApi`
  y `PagosFijosMockApi` para usarlo — misma interfaz pública (`Observable`),
  sin tocar ninguna pantalla. Pagar un pago fijo ahora se ve al instante en
  "Pagados" sin recargar, verificado con Playwright. `*HttpApi` no lo
  necesita (cada `listar()` ya es una petición nueva al backend).
- **`core/domain/fechas.ts` (ampliado):** `AnioMes` (antes vivía solo en
  `pagos-fijos.ts`, se subió aquí para que `creditos.ts` también lo use sin
  ciclo de imports), `anioMesDe`, `sumarMesesAnioMes`, `primerDiaDelMes`,
  `periodoIso`.
- **`core/domain/creditos.ts` (ampliado):** `estadoPagoCreditoEnMes(credito,
movimientos, mes)`, con pruebas — como `estadoPagoCredito` pero para un mes
  concreto en vez de "hoy" (no rueda al mes siguiente si ya se pagó ese mes,
  porque aquí hace falta separar "Por pagar" de "Pagados" del mes que se está
  viendo, no solo mostrar un badge).
- **`core/domain/pagos-fijos-agrupados.ts`** (nuevo, con pruebas):
  `agruparPagosFijosDelMes(pagosFijos, contexto, mes)` — junta los pagos
  fijos propios que apliquen ese mes (`aplicaEnMes`) con las cuotas de
  créditos con cuota mensual (tarjeta, banco, plataforma; personas no tienen
  cuota fija y no aparecen), calcula el `estado` de semáforo de cada uno
  (reutilizando `semaforo()`, fase 1) y arma "por pagar"/"pagados" con
  totales y porcentaje de progreso. Un crédito ya pagado este mes muestra el
  monto real del movimiento, no la cuota "siguiente" que da `cuotaMensual`
  (que para un banco ya pagado apunta al mes que sigue).
- **`shared/month-selector/`** (nuevo): flechas + etiqueta (`.month` del
  prototipo), presentacional — la página dueña calcula el `AnioMes` anterior/
  siguiente con `sumarMesesAnioMes`. Pensado para reusarse en Movimientos
  (fase 7). **`shared/semaforo-badge/`** (nuevo): badge `.badge sem-*` a
  partir de un `EstadoSemaforo` y un texto. **`shared/format/
texto-vencimiento.ts`** (nuevo): "Ya venció"/"Vence hoy"/"Vence mañana"/
  "Vence en N días"/"Pagado" — se sacó de `creditos.page.ts` (fase 5, que
  tenía su propia copia privada) para que Pagos fijos no la duplicara; se
  actualizó `creditos.page.ts` para usar la versión compartida, sin cambiar
  su comportamiento. **`shared/format/fecha.ts`**: `formatearMesAnioCapitalizado`
  ("Septiembre de 2026", para el selector de mes).
- **`features/pagos-fijos/pago-fijo-form/`** (nuevo): crear un pago fijo
  propio (nombre, categoría, cuenta con la que se paga, día límite, monto o
  estimado si es variable, frecuencia, y el mes en que aplica si no es
  mensual). El prototipo solo muestra "Nuevo pago fijo" en esta tab — las
  filas de "Por pagar" tienen `cursor:default`, no son clicables — así que,
  igual que con Créditos en la fase 5, no se agregó editar/archivar un pago
  fijo existente.
- **`movimiento-form-data.ts`/`movimiento-form.ts` (ampliado):** nuevos
  campos `descripcion`, `categoriaId`, `pagoFijoId`, `periodo` para
  precargar el formulario desde "Pagar" (antes solo existían `monto`,
  `cuentaOrigenId`/`cuentaDestinoId`, `creditoId`). `pagoFijoId`/`periodo` no
  son controles editables: viajan por fuera del formulario y se guardan tal
  cual en el movimiento creado, para que "pagado este mes" se pueda detectar
  después.
- **"Pagar" sin formulario propio:** un pago fijo propio reutiliza
  `MovimientoForm` en modo gasto (categoría/cuenta/descripción/monto
  precargados, monto vacío si es variable, para escribir el valor real);
  una cuota de crédito lo reutiliza en modo transferencia con el crédito
  preseleccionado como "Hacia" y el monto de la cuota precargado — mismo
  patrón que "Agregar compra"/"Registrar abono" en Créditos (fase 5).
- Verificado visualmente (Playwright + Edge del sistema): escritorio y móvil
  (390px, oscuro); mes actual con pagados/por pagar mixtos (rojo/amarillo/
  verde), navegación a "Octubre de 2026" recalculando todo (SOAT aparece,
  Impuesto vehicular no, todo vuelve a "por pagar"); "Nuevo pago fijo",
  "Pagar" de un pago propio y de una cuota de crédito con los campos
  correctos precargados; pagar de verdad y ver el ítem moverse a "Pagados"
  sin recargar la página. Sin overflow en ningún ancho. Sin regresiones en
  Cuentas/Créditos tras el cambio de `*MockApi`.
- 104 pruebas unitarias en total (91 + 3 de `estadoPagoCreditoEnMes` + 10 de
  `pagos-fijos-agrupados`).

## Fase 7 — Movimientos (2026-09-11)

Calcada de `#s-movimientos` del prototipo: selector de mes, KPIs de
ingresos/gastos/balance, buscador, chips de tipo, filtros de cuenta/crédito
y categoría, interruptor de internos, y la lista agrupada por día. `.daysep`
no estaba portada a `_componentes.scss` todavía (solo vivía como estilo
inline del prototipo) — se agregó ahí.

- **`core/domain/movimientos-agrupados.ts`** (nuevo, con pruebas):
  - `resumenMovimientos(movimientos)`: ingresos, gastos y balance — solo
    cuenta INGRESO/GASTO, igual que pide la nota "Transferencias,
    movimientos internos y ajustes no cuentan en el resumen". Se calcula
    sobre los movimientos del mes seleccionado, sin aplicar los demás
    filtros (chips/cuenta/categoría/buscador): es un KPI de cabecera, igual
    que "Deuda total" en Créditos no depende del scroll de abajo.
  - `filtrarMovimientos(movimientos, filtros, cuentas, categorias)`: aplica
    chip de tipo, cuenta/crédito (una cuenta raíz incluye sus bolsillos),
    categoría, buscador (descripción o nombre de categoría) e "internos"
    (oculto por defecto, manda encima de cualquier chip).
  - `agruparMovimientosPorDia(movimientos)`: agrupa por fecha, más reciente
    primero; el texto del encabezado ("Hoy"/"Ayer"/fecha) se arma en
    `shared/format/fecha.ts` (`etiquetaDia`), no en el dominio.
  - **Decisión — chip "Transferencias":** el prototipo solo tiene 4 chips
    (Todos/Gastos/Ingresos/Transferencias), sin uno propio para ajustes ni
    movimientos internos (aunque las notas técnicas sí mencionan "ajustes"
    como un tipo de filtro aparte). Se resolvió agrupando bajo
    "Transferencias" todo lo que no es un ingreso ni un gasto
    (TRANSFERENCIA + INTERNO + AJUSTE) — es el único chip que les puede
    aplicar sin inventar uno nuevo que el prototipo no tiene, y el
    interruptor de "internos" sigue funcionando independiente de qué chip
    esté activo.
  - **Decisión — texto "origen → destino":** el prototipo escribe
    literalmente "Cuenta de ahorros → Crédito" (con la palabra genérica
    "Crédito", no el nombre real). Se usó el nombre real del crédito en su
    lugar (`Bancolombia → Libre inversión`), consistente con cómo ya se
    arman los textos automáticos de transferencia en `MovimientoForm`
    (`descripcionAutomaticaTransferencia`, fase 3) y con Créditos/Pagos
    fijos, que siempre muestran el nombre real.
- **`core/domain/opciones-cuenta.ts` (ampliado):**
  `opcionesFiltroMovimientos(cuentas, creditos)` — cuentas raíz (sin sus
  bolsillos, que ya quedan incluidos al filtrar por la raíz) más todos los
  créditos, igual a como el prototipo mezcla ambos en un solo `<select>`.
- **`core/domain/fechas.ts` (ampliado):** `perteneceAlMes(fechaIso, mes)` —
  se subió desde una función privada de `pagos-fijos-agrupados.ts` (fase 6)
  porque ahora también la necesita Movimientos.
- **`shared/format/fecha.ts` (ampliado):** `formatearFechaCompleta` ("11 de
  septiembre de 2026", detalle de un movimiento) y `etiquetaDia` ("Hoy · 11
  de septiembre"/"Ayer · 10 de septiembre"/"9 de septiembre").
- **`movimientos.page.ts/html/scss`**: cada fila se expande con el mismo
  patrón `.stack`/`.detalle` de Cuentas/Créditos (fecha completa, tipo en
  texto, y el pago fijo de origen si aplica, más "Editar"/"Eliminar" como
  chips). "Editar" reutiliza `MovimientoForm` en modo edición
  (`MovimientoFormData.movimiento`, ya soportado desde la fase 3). "Eliminar"
  usa `ConfirmDialog` y, si el movimiento venía de una compra a cuotas
  (`creditoOrigenId` + una `CompraCuotas` con ese `movimientoId`), también
  borra la compra (`ComprasApi.eliminar`, cuyo comentario en la fase 5 ya
  decía "se elimina cuando se elimina el movimiento de gasto que la
  originó" — quedaba pendiente de conectar hasta esta fase). Si el
  movimiento venía de un pago fijo o una cuota de crédito, no hace falta
  ninguna acción extra: `agruparPagosFijosDelMes` (fase 6) ya recalcula
  "pendiente" a partir de si existe o no el movimiento, y gracias al
  `ListStore` (fase 6) el cambio se ve solo con navegar a Pagos fijos.
- Verificado visualmente (Playwright + Edge del sistema): escritorio y móvil
  (390px, oscuro); expandir/contraer una fila; cada chip de tipo; el
  interruptor de internos; buscador; navegación de mes (agosto muestra
  "Tenis Nike" con "3 cuotas" y un ajuste de saldo en amarillo); editar un
  movimiento con los datos precargados en el formulario; eliminar un
  movimiento simple. Regresión de punta a punta navegando por la app (no
  con recargas de página, que resetean el mock en memoria): eliminar el
  gasto de "Netflix" (pago fijo) lo devuelve a "Por pagar" en Pagos fijos;
  eliminar "Tenis Nike" (compra a cuotas) la quita también de la lista de
  compras de la tarjeta en Créditos. Sin overflow en ningún ancho, sin
  errores de consola.
- 113 pruebas unitarias en total (104 + 9 de `movimientos-agrupados`).

## Fase 8 — General (2026-09-11)

Calcada de `#s-general` del prototipo: `.hero` con "Te queda libre este mes",
KPIs (ingresos/gastos/reservado/deuda total) y cuatro paneles de resumen
(Próximos pagos, Cuotas que faltan, Gastos por categoría, Últimos
movimientos), en `cols-3`. Es la única pantalla sin datos propios: junta
funciones de dominio ya construidas en las fases 4-7 más dos nuevas. `.catbar`
no estaba portada a `_componentes.scss` todavía (solo vivía como estilo
inline del prototipo) — se agregó ahí.

- **`core/domain/gastos-por-categoria.ts`** (nuevo, con pruebas):
  `gastosPorCategoriaDelMes(movimientos, categorias, mes)` — gastos del mes
  agrupados por categoría, de mayor a menor, con un `porcentaje` (0-100)
  relativo a la categoría con más gasto (esa queda en 100, igual a las
  barras del prototipo). Los gastos sin categoría no entran, no hay dónde
  agruparlos.
- **`core/domain/progreso-creditos.ts`** (nuevo, con pruebas):
  `creditosConCuotasPendientes(creditos, compras, movimientos, hoy)` — para
  el panel "Cuotas que faltan": bancos, con su plazo fijo (`X de Y` = cuotas
  que faltan de las totales, barra = pagadas/total); tarjetas y
  plataformas, según la compra con más cuotas por delante (la misma que ya
  usa `cuotasFaltantes()` de la fase 5 para decidir cuántas le faltan al
  crédito). Personas no manejan cuotas y no aparecen; tampoco los créditos
  ya sin cuotas pendientes.
- **`libreDelMes`** (`core/domain/libre-del-mes.ts`) ya existía desde la
  fase 6, construida ahí a propósito para esta pantalla — no hizo falta
  tocarla.
- **`shared/format/fecha.ts` (ampliado):** `formatearNombreMes` ("septiembre",
  sin año) — el prototipo escribe literalmente "Falta por pagar en
  septiembre" como texto fijo; acá sale del mes actual de verdad.
- **`general.page.ts/html/scss`**: sin selector de mes (siempre "este mes",
  el de hoy — la tab no tiene datos propios que navegar). "Ver todos"/"Ver
  créditos" son `routerLink` a Pagos fijos/Créditos/Movimientos (primer uso
  de `RouterLink` fuera del shell). El botón de "ocultar montos" ya vivía en
  el shell desde el sistema de diseño (aplica a todas las tabs), así que no
  hizo falta nada nuevo para ese punto de las notas.
  - **Próximos pagos:** las 3 primeras de `resumen().porPagar` (mismo
    `agruparPagosFijosDelMes` de Pagos fijos, con el mes de hoy). Sin el
    badge "Crédito" adicional que sí tiene su tab completa: el prototipo no
    lo muestra acá.
  - **Cuotas que faltan:** las 3 primeras de `creditosConCuotasPendientes`.
  - **Gastos por categoría:** todas las categorías con gasto en el mes (las
    notas no ponen límite, a diferencia de "Próximos pagos"/"Últimos
    movimientos").
  - **Últimos movimientos:** las 3 más recientes (`notas-app-finanzas.md`
    lo pide explícito: "los 3 más recientes"), con "Hoy/Ayer · cuenta"
    (no categoría, a diferencia de la fila del mismo movimiento en
    Movimientos) — igual al prototipo.
- **Decisión — íconos por fila en "Próximos pagos":** el prototipo dibuja
  íconos distintos por fila (`bolt`, `water_drop`, `credit_card`), pero ni
  `PagoFijo` tiene un campo para eso ni la sección `#s-pagos` (la tab
  completa de Pagos fijos, ya construida en la fase 6) los usa. Se trataron
  como decorativos y no se reprodujeron, igual que ya se había decidido en
  Pagos fijos.
- **Bug real encontrado y corregido (afecta a toda la app, no solo esta
  fase):** `shared/amount/amount.html` tenía un espacio de más entre el
  signo (+/−) y el monto en filas como "+$4.800.000" (se veía "+
  $4.800.000") — el bloque `@else { ... }` del componente dejaba un
  salto de línea como texto significativo alrededor de la interpolación.
  Se corrigió a una sola línea (`@else {{{ valor() | monedaCop }}}`).
  `movimientos.page.html` tenía el mismo problema por su cuenta (indentación
  del signo en una línea aparte) y se corrigió igual.
- Ajustado el budget de bundle inicial en `angular.json` (600kB → 650kB): el
  build ya venía muy justo desde antes de esta fase: agregar `general-page`
  lo pasó por 2,93kB. No hay nada que recortar de forma razonable a esta
  altura; es crecimiento esperado con 8 pantallas completas.
- Verificado visualmente (Playwright + Edge del sistema): escritorio, móvil
  (390px, oscuro), botón de "ocultar montos" (los `~6` paneles respetan el
  `$ ••••••` global), y los enlaces "Ver todos"/"Ver créditos" navegando a
  la tab correspondiente. Sin overflow en ningún ancho, sin errores de
  consola.
- 122 pruebas unitarias en total (113 + 3 de `gastos-por-categoria` + 6 de
  `progreso-creditos`).

## Decisiones tomadas (no estaban explícitas en las notas)

- **Versión de Angular:** 21 (estable más reciente que corre con Node 20.19
  instalado; Angular 22 exige Node ≥22.22 y no estaba disponible). Usa el
  runner de pruebas por defecto de esa versión (Vitest) en vez de
  Karma/Jasmine, y **zoneless** (`provideZonelessChangeDetection`) en vez de
  Zone.js, que tampoco viene instalado por defecto en `ng new` v21.
- **Alcance de "esqueleto" (2026-09-11):** se interpretó como Fases 1 y 2 del
  plan original (todo lo técnico: modelos, dominio, API, layout/navegación),
  dejando fuera el maquetado visual real de cada pantalla porque el diseño
  se resuelve aparte en el diseñador de Claude.
- **Recursos de API sin endpoint propio:** `ExtractoTarjeta` y `CambioTasa`
  (notas técnicas) no están en la lista de endpoints sugeridos del prompt.
  Se modelaron como métodos anidados de `CreditosApi`
  (`listarExtractos`/`registrarExtracto`, `listarCambiosTasa`/
  `registrarCambioTasa`) en vez de como recursos top-level.
- **`cuotasFaltantesCompra` (dominio):** al no estar detallado el mecanismo
  exacto de "cuota pagada" por compra individual (solo existe a nivel de
  crédito bancario, vía movimientos), se aproximó con meses transcurridos
  desde la fecha de compra. Documentado en el código; revisar si no calza
  con un caso real al construir la pantalla de Créditos (fase 5).

- **Cada componente en 3 archivos (`.ts` + `.html` + `.scss`):** las 5 páginas
  de `features/` (y el shell) ya no usan `template`/`styles` inline —
  `templateUrl`/`styleUrl` apuntando a `<nombre>.page.html`/`.scss`. Es la
  estructura que se usa de acá en adelante para cada pantalla nueva (fase 3+).
- **`shared/`, creado bajo demanda:** los componentes compartidos del prompt
  (`amount`, `empty-state`, `confirm-dialog` en fase 4; `semaforo-badge`,
  `month-selector` en fase 6) se crean cuando la fase que los necesita los
  consume de verdad, ya con las clases de `styles/_componentes.scss`
  disponibles para apoyarse en ellas (`.badge.sem-*`, `.bar`, `.empty`...).
  Falta `progress-bar` (la barra `.bar` se sigue usando directo con
  `[style.width.%]`, no hizo falta envolverla todavía).

## Archivos clave por fase

**Fase 1:** `src/app/core/models/`, `src/app/core/domain/`,
`src/app/core/api/`, `src/environments/`.

**Fase 2:** `src/app/layout/`, `src/app/app.ts`, `src/app/app.routes.ts`,
`src/app/features/*/*.page.ts` (marcadores).

**Sistema de diseño:** `src/styles/tokens/`, `src/styles/_componentes.scss`,
`src/styles.scss`, `src/index.html`, `src/app/core/montos-visibility.service.ts`.

**Fase 3:** `src/app/movimiento-form/`, `src/app/shared/format/`,
`src/app/shared/pipes/`, `src/app/core/domain/opciones-cuenta.ts`,
`src/app/core/domain/clasificacion-movimiento.ts`,
`src/app/layout/nuevo-movimiento/nuevo-movimiento.service.ts`.

**Fase 4:** `src/app/features/cuentas/`, `src/app/core/domain/cuentas-agrupadas.ts`,
`src/app/shared/amount/`, `src/app/shared/empty-state/`,
`src/app/shared/confirm-dialog/`.

**Fase 5:** `src/app/features/creditos/`, `src/app/core/domain/creditos-agrupados.ts`,
`src/app/shared/format/fecha.ts`, `src/app/shared/format/porcentaje.ts`.

**Fase 6:** `src/app/features/pagos-fijos/`, `src/app/core/api/list-store.ts`,
`src/app/core/domain/pagos-fijos-agrupados.ts`, `src/app/shared/month-selector/`,
`src/app/shared/semaforo-badge/`, `src/app/shared/format/texto-vencimiento.ts`.

**Fase 7:** `src/app/features/movimientos/`,
`src/app/core/domain/movimientos-agrupados.ts`.

**Fase 8:** `src/app/features/general/`,
`src/app/core/domain/gastos-por-categoria.ts`,
`src/app/core/domain/progreso-creditos.ts`.

**Rediseño de UI (fases 1-5):** `src/styles/tokens/`,
`src/styles/_componentes.scss`, `scripts/verificar-contraste.mjs`,
`src/app/shared/stat-card/`, `src/app/shared/skeleton-rows/`,
`src/app/shared/charts/`, `src/app/shared/motion/`,
`src/app/core/domain/tendencia-mes.ts`, `ngsw-config.json`.

**Reorganización del mock:** `src/app/shared/page-head/`,
`src/app/layout/shell/`, los `*.page.html`/`.ts` de las cinco pantallas,
`src/styles/_componentes.scss`, `src/app/core/api/creditos/cambios-tasa.util.ts`.

## Cómo correr

Ver `README.md` para el detalle completo (arquitectura, requisitos,
desplegar). Resumen:

- `npm start` — `ng serve`, contra Firestore real. El modo de datos de
  prueba (`useMock`, los `*MockApi` y los escenarios) se retiró: para
  probar como alguien nuevo se usa "Regístrate" (sesión anónima).
- `npm test` — pruebas unitarias (Vitest), 147 pruebas (143 en `core/domain` + 4 en `app.spec.ts`).
- `npm run build` — build de producción.
- `npm run deploy` — build + `firebase deploy --only hosting`.

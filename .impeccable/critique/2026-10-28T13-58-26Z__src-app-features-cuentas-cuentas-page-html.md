---
target: pantalla Cuentas
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:C:\\Users\\Cristhian\\Documents\\Desarrollo\\app-finanzas\\publica\\frontend\\src\\app\\features\\cuentas\\cuentas.page.html"
target_fingerprint: "sha256:c8177a61f02aa20e8ec0b67349b552bdca9fd74d61abbf5ae9ba6ed897f8721a"
target_path: "C:\\Users\\Cristhian\\Documents\\Desarrollo\\app-finanzas\\publica\\frontend\\src\\app\\features\\cuentas\\cuentas.page.html"
timestamp: 2026-10-28T13-58-26Z
slug: src-app-features-cuentas-cuentas-page-html
---
# Crítica: Cuentas (web + móvil)
Método: dual-agent (A: revisión de diseño · B: detector + navegador)

## Heurísticas (19/40, Poor)
1 Estado 2 · 2 Mundo real 3 · 3 Control 3 · 4 Consistencia 1 · 5 Prevención 2 · 6 Reconocimiento 3 · 7 Eficiencia 2 · 8 Minimalismo 1 · 9 Recuperación 0 · 10 Ayuda 2

## Prioridades
- [P0] Error de carga se muestra como "no tienes cuentas" (primera-carga.ts catchError -> of(true)).
- [P1] Mismo número repetido 3-4 veces (cabecera de grupo, fila, tarjeta "Dónde está tu dinero", desglose del hero).
- [P1] "+" del topbar (agregar cuenta) compite con el FAB (nuevo movimiento); botones de 40px.
- [P1] Web con otro lenguaje visual (Anton mayúsculas, tarjeta de cabecera, píldora negra).
- [P2] Fila expandida: 5 acciones, chips de 36px, Archivar igual a Editar.

## Menores
"1 cuentas activas"/"1 bolsillos"; todo archivado dice "Todavía no tienes cuentas"; etiquetas del hero se parten a 375px; mayúsculas mezcladas; guilloché detrás del texto en móvil; listar() suscrito dos veces.

## Detector
CLI: 2 avisos design-system-color rgb(0,0,0) (falsos positivos). Navegador: overused-font Plus Jakarta Sans (97%).

---
target: General (dashboard)
total_score: 14
max_score: 24
na_heuristics: 5,7,9,10
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\Cristhian\\Documents\\RANVI LAB\\Aplicaciones\\App-finanzas\\publica\\frontend\\src\\app\\features\\general\\general.page.html"
target_fingerprint: "sha256:8d319205ce255847b17fbc495570508be2d8943e69274e2c53548a329721c108"
target_path: "C:\\Users\\Cristhian\\Documents\\RANVI LAB\\Aplicaciones\\App-finanzas\\publica\\frontend\\src\\app\\features\\general\\general.page.html"
timestamp: 2026-11-11T00-15-05Z
slug: src-app-features-general-general-page-html
---
DEGRADED: single-context (sin subagentes; sin navegador por sesión cerrada)

## Crítica de General
Veredicto: composición intercambiable (tarjetas blancas, KPIs, héroe con degradado, banner rojo, píldoras). Detector: solo avisos de deriva contra DESIGN.md (desactualizado).

Score 14/24 (58 %, Aceptable). n/a: 5, 7, 9, 10.
1 Estado 3 · 2 Lenguaje real 2 (jerga) · 3 Control 3 · 4 Consistencia 2 (3 estilos de píldora, 3 de cabecera) · 6 Reconocimiento 3 · 8 Minimalismo 1.

Prioridades
- [P1] Mismo dato repetido hasta 3 veces (fecha de pago en encabezado, héroe y ciclo; libre en frase y caja; tope diario dos veces). Fix: distill.
- [P1] Sopa de píldoras (12+) y cajas anidadas (3 niveles). Fix: 2-3 píldoras; cajas del héroe -> ecuación en una línea. distill + layout.
- [P1] Jerarquía invertida: la alerta roja pesa más que el número; KPIs con 4 colores; $0 en verde. Fix: quieter.
- [P2] Copia/jerga: "Margen diario seguro", "= Disponible real", "Nivel alto". Fix: clarify.
- [P2] Tipografía amontonada 12-14 px y DESIGN.md obsoleto. Fix: typeset + document.

Personas: Jordan (jerga, no sabe por dónde empezar), Casey (14 bloques en celular, lo accionable bajo el pliegue), Sam (rótulos 12 px grises).

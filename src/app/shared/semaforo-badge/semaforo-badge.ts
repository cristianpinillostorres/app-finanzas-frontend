import { Component, input } from '@angular/core';

import type { EstadoSemaforo } from '../../core/domain';

/**
 * Badge de semáforo de fecha límite (clases `.badge sem-*` del prototipo):
 * verde/amarillo/rojo según los días que faltan, o gris "Pagado". El texto
 * lo decide quien lo usa (ver `textoVencimiento`), porque varía según la
 * pantalla (Créditos no muestra "Pagado" en el badge, Pagos fijos sí).
 */
@Component({
  selector: 'app-semaforo-badge',
  standalone: true,
  templateUrl: './semaforo-badge.html',
})
export class SemaforoBadge {
  estado = input.required<EstadoSemaforo>();
  texto = input.required<string>();
}

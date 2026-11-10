import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { Amount } from '../amount/amount';

/**
 * Semántica de color de un indicador. No es decorativa: es la misma del
 * sistema de diseño (ingreso verde, gasto rojo suave, deuda ámbar, neutro
 * para saldos) — ver `styles/tokens/_semanticos.scss`.
 */
export type TonoStatCard = 'ingreso' | 'gasto' | 'deuda' | 'neutro';

const CLASE_MONTO: Record<TonoStatCard, string> = {
  ingreso: 'mon-in',
  gasto: 'mon-out',
  deuda: 'mon-deuda',
  neutro: '',
};

/**
 * Tarjeta de indicador: etiqueta y monto grande, con el monto en el color
 * de su tono. Envuelve el patrón `.stat-card` de
 * `styles/_componentes.scss` para no repetir el mismo bloque de markup en
 * General, Cuentas, Créditos y Movimientos.
 *
 * El monto pasa por `<app-amount>`, así que respeta el botón global de
 * ocultar montos sin que cada pantalla tenga que acordarse.
 */
@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [MatIconModule, Amount],
  templateUrl: './stat-card.html',
  styleUrl: './stat-card.scss',
})
export class StatCard {
  etiqueta = input.required<string>();
  valor = input.required<number | null | undefined>();
  tono = input<TonoStatCard>('neutro');
  /** Nombre opcional de un ícono de Material Symbols, junto a la etiqueta. */
  icono = input<string>('');
  /** Mientras la pantalla espera sus datos: esqueleto en vez del monto. */
  cargando = input(false);
  /** Una línea corta bajo el monto, para explicar un valor que sorprende (un $0, por ejemplo). */
  nota = input<string>('');

  /** En cero no hay nada que señalar: "$0" en ámbar parecía una alerta. */
  protected claseMonto(): string {
    if (!this.valor()) return '';
    return CLASE_MONTO[this.tono()];
  }
}

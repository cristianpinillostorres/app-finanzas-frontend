import { Component, computed, input } from '@angular/core';

import type { DiaLineaDelMes, LineaDelMes, TramoPago } from '../../core/domain';

const NOMBRE_TRAMO: Record<TramoPago, [string, string]> = {
  vencido: ['vencido', 'vencidos'],
  semana: ['esta semana', 'esta semana'],
  despues: ['más adelante', 'más adelante'],
  pagado: ['pagado', 'pagados'],
};

const ORDEN_TRAMOS: TramoPago[] = ['vencido', 'semana', 'despues', 'pagado'];

/**
 * El mes de un vistazo: una pista del día 1 al último, con hoy marcado y
 * una marca por cada día en que vence algo (el número dice cuántos pagos
 * caen ese día). Responde "¿qué tengo que pagar y cuándo?" sin leer una
 * lista: lo vencido queda a la izquierda de hoy, lo que viene a la derecha.
 *
 * El color no va solo: cada tramo tiene también forma (lo pagado es un
 * aro hueco) y el resumen debajo dice los conteos en texto, que es además
 * lo que lee un lector de pantalla.
 */
@Component({
  selector: 'app-franja-mes',
  standalone: true,
  templateUrl: './franja-mes.html',
  styleUrl: './franja-mes.scss',
})
export class FranjaMes {
  linea = input.required<LineaDelMes>();

  /** Centro del día en la pista, de 0 a 1. */
  protected posicion(fecha: Date): number {
    return (fecha.getDate() - 0.5) / this.linea().diasDelMes;
  }

  protected readonly posicionHoy = computed(() => {
    const hoy = this.linea().hoy;
    return hoy ? this.posicion(hoy) : null;
  });

  protected cantidad(dia: DiaLineaDelMes): number {
    return dia.items.length;
  }

  protected readonly etiquetaInicio = computed(() => this.etiquetaDia(1));
  protected readonly etiquetaFin = computed(() => this.etiquetaDia(this.linea().diasDelMes));

  private etiquetaDia(dia: number): string {
    const { anio, mes } = this.linea().mes;
    const nombreMes = new Date(anio, mes - 1, 1)
      .toLocaleDateString('es-CO', { month: 'short' })
      .replace('.', '');
    return `${dia} ${nombreMes}`;
  }

  /** "3 vencidos · 2 esta semana · 9 más adelante · 4 pagados", sin los tramos en cero. */
  protected readonly resumen = computed(() =>
    ORDEN_TRAMOS.filter((t) => this.linea().conteo[t] > 0).map((tramo) => {
      const n = this.linea().conteo[tramo];
      const [uno, varios] = NOMBRE_TRAMO[tramo];
      return { tramo, texto: `${n} ${n === 1 ? uno : varios}` };
    }),
  );
}

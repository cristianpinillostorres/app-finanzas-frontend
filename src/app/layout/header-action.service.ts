import { Injectable, signal } from '@angular/core';

export interface AccionHeader {
  /** Ícono de Material Symbols Outlined. */
  icono: string;
  /** `aria-label` del botón. */
  etiqueta: string;
  accion: () => void;
  /**
   * Esconde el "+" flotante de nuevo movimiento mientras la pantalla está
   * abierta: con los dos "+" a la vista, uno arriba y otro abajo, no se sabía
   * cuál agregaba qué.
   */
  ocultaNuevoMovimiento?: boolean;
}

/**
 * Acción contextual de la pantalla actual, mostrada en el header móvil
 * junto al botón de ocultar montos (ver `Shell`) — ej. "Agregar cuenta" en
 * Cuentas, "Nuevo pago fijo" en Pagos fijos. Cada pantalla que la usa debe
 * `establecer()` la suya al iniciar y `limpiar()` al destruirse (con
 * `DestroyRef`, ver `CuentasPage`), para no dejarle al Shell una acción
 * que ya no aplica — o peor, que llame a un método de un componente ya
 * destruido — al navegar a otra tab.
 */
@Injectable({ providedIn: 'root' })
export class HeaderActionService {
  private readonly _accion = signal<AccionHeader | null>(null);
  readonly accion = this._accion.asReadonly();

  establecer(accion: AccionHeader): void {
    this._accion.set(accion);
  }

  limpiar(): void {
    this._accion.set(null);
  }
}

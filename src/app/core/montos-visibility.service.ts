import { Injectable, signal } from '@angular/core';

/**
 * Estado global de "ocultar montos" (botón en la barra superior/móvil,
 * visible en todas las tabs). El componente compartido `amount` (`shared/`,
 * fase 3+) lo consulta para mostrar "$ ••••••" en vez del valor real.
 */
@Injectable({ providedIn: 'root' })
export class MontosVisibilityService {
  private readonly _oculto = signal(false);
  readonly oculto = this._oculto.asReadonly();

  alternar(): void {
    this._oculto.update((valor) => !valor);
  }
}

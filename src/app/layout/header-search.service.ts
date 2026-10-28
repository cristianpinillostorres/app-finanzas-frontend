import { Injectable, signal } from '@angular/core';

/**
 * Barra de búsqueda que reemplaza el header móvil entero (a diferencia de
 * `HeaderActionService`, que solo agrega un botón junto al ojito) — hoy solo
 * la usa Movimientos, pero vive en `layout/` porque es el `Shell` quien la
 * pinta. La pantalla activa se `registrar()` al iniciar (icono "search" +
 * `etiqueta`/`placeholder`) y se `limpiar()` al destruirse con `DestroyRef`,
 * mismo patrón que `HeaderActionService`.
 *
 * El término no persiste al cerrar la barra ni al cambiar de mes/tab —
 * decisión explícita del handoff de diseño de Movimientos (2026-09-21): se
 * limpia siempre, no solo se cierra.
 */
@Injectable({ providedIn: 'root' })
export class HeaderSearchService {
  private readonly _placeholder = signal<string | null>(null);
  private readonly _abierta = signal(false);
  private readonly _termino = signal('');

  readonly placeholder = this._placeholder.asReadonly();
  readonly abierta = this._abierta.asReadonly();
  readonly termino = this._termino.asReadonly();

  registrar(placeholder: string): void {
    this._placeholder.set(placeholder);
  }

  limpiar(): void {
    this._placeholder.set(null);
    this._abierta.set(false);
    this._termino.set('');
  }

  abrir(): void {
    this._abierta.set(true);
  }

  cerrar(): void {
    this._abierta.set(false);
    this._termino.set('');
  }

  escribir(valor: string): void {
    this._termino.set(valor);
  }
}

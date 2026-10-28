import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';

import type { CompraCuotas } from '../../models';

/** Compras a cuotas con tarjeta o plataforma. */
export interface ComprasApi {
  listar(): Observable<CompraCuotas[]>;
  listarPorCredito(creditoId: string): Observable<CompraCuotas[]>;
  crear(datos: Omit<CompraCuotas, 'id'>): Observable<CompraCuotas>;
  /** Al editar el gasto que la originó (monto, cuotas, descripción...). */
  actualizar(id: string, cambios: Partial<CompraCuotas>): Observable<CompraCuotas>;
  /** Se elimina cuando se elimina el movimiento de gasto que la originó. */
  eliminar(id: string): Observable<void>;
}

export const COMPRAS_API = new InjectionToken<ComprasApi>('ComprasApi');

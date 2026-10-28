import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';

import type { Movimiento } from '../../models';

/**
 * Historial de movimientos. Devuelve todo el histórico: filtrar por mes,
 * cuenta, tipo, categoría o texto es responsabilidad de quien consume la
 * API (domain / estado de cada pantalla), no de esta capa de datos.
 */
export interface MovimientosApi {
  listar(): Observable<Movimiento[]>;
  obtener(id: string): Observable<Movimiento | undefined>;
  crear(datos: Omit<Movimiento, 'id' | 'creadoEn'>): Observable<Movimiento>;
  actualizar(id: string, cambios: Partial<Movimiento>): Observable<Movimiento>;
  eliminar(id: string): Observable<void>;
}

export const MOVIMIENTOS_API = new InjectionToken<MovimientosApi>('MovimientosApi');

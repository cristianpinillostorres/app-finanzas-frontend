import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';

import type { CambioTasa, Credito, ExtractoTarjeta, NuevoCredito } from '../../models';

/**
 * Créditos (tarjetas, bancos, plataformas y personas). Incluye el historial
 * de extractos de tarjeta y de cambios de tasa, que en el backend viven bajo
 * `/api/creditos/{id}` por ser datos propios de cada crédito.
 */
export interface CreditosApi {
  listar(): Observable<Credito[]>;
  obtener(id: string): Observable<Credito | undefined>;
  crear(datos: NuevoCredito): Observable<Credito>;
  actualizar(id: string, cambios: Partial<Credito>): Observable<Credito>;
  archivar(id: string): Observable<void>;

  listarExtractos(creditoId: string): Observable<ExtractoTarjeta[]>;
  registrarExtracto(datos: Omit<ExtractoTarjeta, 'id'>): Observable<ExtractoTarjeta>;

  listarCambiosTasa(creditoId: string): Observable<CambioTasa[]>;
  registrarCambioTasa(datos: Omit<CambioTasa, 'id'>): Observable<CambioTasa>;
}

export const CREDITOS_API = new InjectionToken<CreditosApi>('CreditosApi');

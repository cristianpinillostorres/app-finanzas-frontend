import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';

import type { PagoFijo } from '../../models';

/** Pagos fijos propios (arriendo, servicios, suscripciones...). No incluye cuotas de créditos. */
export interface PagosFijosApi {
  listar(): Observable<PagoFijo[]>;
  crear(datos: Omit<PagoFijo, 'id'>): Observable<PagoFijo>;
  actualizar(id: string, cambios: Partial<PagoFijo>): Observable<PagoFijo>;
}

export const PAGOS_FIJOS_API = new InjectionToken<PagosFijosApi>('PagosFijosApi');

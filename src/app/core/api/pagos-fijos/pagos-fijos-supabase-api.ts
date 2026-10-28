import { Injectable, inject } from '@angular/core';
import { Observable, defer, from, map, of } from 'rxjs';

import type { PagoFijo } from '../../models';
import { SincronizacionService } from '../../sync/sincronizador';
import { type Fila, idNuevo } from '../../sync/tablas';
import type { PagosFijosApi } from './pagos-fijos-api';

/**
 * Tabla `pagos_fijos` — el más simple de los recursos. Lee y escribe la
 * copia local de `SesionLocal` (en vivo y sin esperar al servidor).
 */
@Injectable()
export class PagosFijosSupabaseApi implements PagosFijosApi {
  private readonly sync = inject(SincronizacionService);

  listar(): Observable<PagoFijo[]> {
    return defer(() => this.sync.actual().observar('pagos_fijos')).pipe(
      map((filas) => filas as unknown as PagoFijo[]),
    );
  }

  crear(datos: Omit<PagoFijo, 'id'>): Observable<PagoFijo> {
    const pago: PagoFijo = { ...datos, id: idNuevo() };
    this.sync.actual().guardar('pagos_fijos', pago as unknown as Fila);
    return of(pago);
  }

  actualizar(id: string, cambios: Partial<PagoFijo>): Observable<PagoFijo> {
    return from(this.sync.actual().actualizar('pagos_fijos', id, cambios)).pipe(
      map((fila) => fila as unknown as PagoFijo),
    );
  }
}

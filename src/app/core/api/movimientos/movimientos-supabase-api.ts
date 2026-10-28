import { Injectable, inject } from '@angular/core';
import { Observable, defer, from, map, of } from 'rxjs';

import type { Movimiento } from '../../models';
import { SincronizacionService } from '../../sync/sincronizador';
import { type Fila, idNuevo } from '../../sync/tablas';
import type { MovimientosApi } from './movimientos-api';

/**
 * Tabla `movimientos`. Ninguno de sus campos opcionales tiene significado
 * en `null` — todos son "no aplica" —, así que sirve el mapeo genérico de
 * `desdeFila`.
 *
 * Lee y escribe la copia local de `SesionLocal`: registrar un gasto sin
 * señal cierra el formulario al instante y se sube solo al volver la red.
 */
@Injectable()
export class MovimientosSupabaseApi implements MovimientosApi {
  private readonly sync = inject(SincronizacionService);

  listar(): Observable<Movimiento[]> {
    return defer(() => this.sync.actual().observar('movimientos')).pipe(
      map((filas) => filas as unknown as Movimiento[]),
    );
  }

  obtener(id: string): Observable<Movimiento | undefined> {
    return defer(() => from(this.sync.actual().obtener('movimientos', id))).pipe(
      map((fila) => fila as unknown as Movimiento | undefined),
    );
  }

  crear(datos: Omit<Movimiento, 'id' | 'creadoEn'>): Observable<Movimiento> {
    const movimiento: Movimiento = { ...datos, id: idNuevo(), creadoEn: new Date().toISOString() };
    this.sync.actual().guardar('movimientos', movimiento as unknown as Fila);
    return of(movimiento);
  }

  actualizar(id: string, cambios: Partial<Movimiento>): Observable<Movimiento> {
    return from(this.sync.actual().actualizar('movimientos', id, cambios)).pipe(
      map((fila) => fila as unknown as Movimiento),
    );
  }

  eliminar(id: string): Observable<void> {
    this.sync.actual().eliminar('movimientos', id);
    return of(undefined);
  }
}

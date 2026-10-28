import { Injectable, inject } from '@angular/core';
import { Observable, defer, from, map, of } from 'rxjs';

import type { CompraCuotas } from '../../models';
import { SincronizacionService } from '../../sync/sincronizador';
import { type Fila, idNuevo } from '../../sync/tablas';
import type { ComprasApi } from './compras-api';

/**
 * Tabla `compras` — recurso propio, no anidado bajo créditos (así lo pide
 * `ComprasApi`). `listarPorCredito` filtra la copia local.
 *
 * Lee y escribe la copia local de `SesionLocal` (en vivo y sin esperar al
 * servidor).
 */
@Injectable()
export class ComprasSupabaseApi implements ComprasApi {
  private readonly sync = inject(SincronizacionService);

  listar(): Observable<CompraCuotas[]> {
    return defer(() => this.sync.actual().observar('compras')).pipe(
      map((filas) => filas as unknown as CompraCuotas[]),
    );
  }

  listarPorCredito(creditoId: string): Observable<CompraCuotas[]> {
    return this.listar().pipe(map((compras) => compras.filter((c) => c.creditoId === creditoId)));
  }

  crear(datos: Omit<CompraCuotas, 'id'>): Observable<CompraCuotas> {
    const compra: CompraCuotas = { ...datos, id: idNuevo() };
    this.sync.actual().guardar('compras', compra as unknown as Fila);
    return of(compra);
  }

  actualizar(id: string, cambios: Partial<CompraCuotas>): Observable<CompraCuotas> {
    return from(this.sync.actual().actualizar('compras', id, cambios)).pipe(
      map((fila) => fila as unknown as CompraCuotas),
    );
  }

  eliminar(id: string): Observable<void> {
    this.sync.actual().eliminar('compras', id);
    return of(undefined);
  }
}

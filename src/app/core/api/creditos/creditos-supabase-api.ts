import { Injectable, inject } from '@angular/core';
import { Observable, defer, from, map, of } from 'rxjs';

import type { CambioTasa, Credito, ExtractoTarjeta, NuevoCredito } from '../../models';
import { SincronizacionService } from '../../sync/sincronizador';
import { type Fila, idNuevo } from '../../sync/tablas';
import type { CreditosApi } from './creditos-api';

/**
 * Tablas `creditos`, `extractos` y `cambios_tasa` (estas dos con
 * `creditoId`; listarlas filtra la copia local por crédito).
 *
 * `Credito` es una unión discriminada por `grupo` (ver
 * `core/models/credito.model.ts`): se guarda como una fila "ancha" con las
 * columnas que apliquen a cada grupo; la base valida que estén las que el
 * grupo exige.
 *
 * Lee y escribe la copia local de `SesionLocal` (en vivo y sin esperar al
 * servidor).
 */
@Injectable()
export class CreditosSupabaseApi implements CreditosApi {
  private readonly sync = inject(SincronizacionService);

  listar(): Observable<Credito[]> {
    return defer(() => this.sync.actual().observar('creditos')).pipe(
      map((filas) => filas as unknown as Credito[]),
    );
  }

  obtener(id: string): Observable<Credito | undefined> {
    return defer(() => from(this.sync.actual().obtener('creditos', id))).pipe(
      map((fila) => fila as unknown as Credito | undefined),
    );
  }

  crear(datos: NuevoCredito): Observable<Credito> {
    const credito = {
      ...datos,
      id: idNuevo(),
      archivado: false,
      creadoEn: new Date().toISOString(),
    } as Credito;
    this.sync.actual().guardar('creditos', credito as unknown as Fila);
    return of(credito);
  }

  actualizar(id: string, cambios: Partial<Credito>): Observable<Credito> {
    return from(this.sync.actual().actualizar('creditos', id, cambios)).pipe(
      map((fila) => fila as unknown as Credito),
    );
  }

  archivar(id: string): Observable<void> {
    this.sync
      .actual()
      .actualizar('creditos', id, { archivado: true })
      .catch((error) => console.error(`No se pudo archivar el crédito ${id}`, error));
    return of(undefined);
  }

  listarExtractos(creditoId: string): Observable<ExtractoTarjeta[]> {
    return defer(() => this.sync.actual().observar('extractos')).pipe(
      map((filas) =>
        (filas as unknown as ExtractoTarjeta[]).filter((e) => e.creditoId === creditoId),
      ),
    );
  }

  registrarExtracto(datos: Omit<ExtractoTarjeta, 'id'>): Observable<ExtractoTarjeta> {
    const extracto: ExtractoTarjeta = { ...datos, id: idNuevo() };
    this.sync.actual().guardar('extractos', extracto as unknown as Fila);
    return of(extracto);
  }

  listarCambiosTasa(creditoId: string): Observable<CambioTasa[]> {
    return defer(() => this.sync.actual().observar('cambios_tasa')).pipe(
      map((filas) => (filas as unknown as CambioTasa[]).filter((c) => c.creditoId === creditoId)),
    );
  }

  registrarCambioTasa(datos: Omit<CambioTasa, 'id'>): Observable<CambioTasa> {
    const cambio: CambioTasa = { ...datos, id: idNuevo() };
    this.sync.actual().guardar('cambios_tasa', cambio as unknown as Fila);
    return of(cambio);
  }
}

import { Injectable, inject } from '@angular/core';
import { Observable, defer, map, of } from 'rxjs';

import type { CambiosCategoria, Categoria, NuevaCategoria } from '../../models';
import { SincronizacionService } from '../../sync/sincronizador';
import { idNuevo } from '../../sync/tablas';
import type { CategoriasApi } from './categorias-api';
import { CATALOGO_CATEGORIAS, type DocCategoria, combinarCategorias } from './categorias-catalogo';

/**
 * Tabla `categorias`: solo lo que la persona personalizó, en `datos`
 * (jsonb). Las del catálogo base no se copian; una fila con su mismo id
 * guarda nada más los cambios. Por eso `actualizar` combina con lo que ya
 * haya: la fila de una categoría base puede no existir todavía.
 *
 * Un campo que se vacía se guarda en `null` y no se omite: `topeMensual:
 * null` es "quitó el tope", distinto de no haberlo tocado nunca.
 */
@Injectable()
export class CategoriasSupabaseApi implements CategoriasApi {
  private readonly sync = inject(SincronizacionService);

  listar(): Observable<Categoria[]> {
    return defer(() => this.sync.actual().observar('categorias')).pipe(
      map((filas) =>
        combinarCategorias(
          CATALOGO_CATEGORIAS,
          filas.map((f) => ({ id: f.id, datos: (f['datos'] ?? {}) as DocCategoria })),
        ),
      ),
    );
  }

  crear(datos: NuevaCategoria): Observable<Categoria> {
    const categoria: Omit<Categoria, 'id'> = { ...datos, archivada: false, personalizada: true };
    const id = idNuevo();
    this.sync.actual().guardar('categorias', { id, datos: conNulos(categoria) });
    return of({ ...categoria, id });
  }

  actualizar(id: string, cambios: CambiosCategoria): Observable<void> {
    const sesion = this.sync.actual();
    sesion
      .obtener('categorias', id)
      .then((actual) =>
        sesion.guardar('categorias', {
          id,
          datos: { ...((actual?.['datos'] as DocCategoria | undefined) ?? {}), ...conNulos(cambios) },
        }),
      )
      .catch((error) => console.error(`No se pudo actualizar la categoría ${id}`, error));
    return of(undefined);
  }
}

/** JSON omite los `undefined`; aquí significan "vacío", así que pasan a `null`. */
function conNulos(valor: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(valor).map(([clave, v]) => [clave, v === undefined ? null : v]),
  );
}

import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';

import type { CambiosCategoria, Categoria, NuevaCategoria } from '../../models';

/**
 * Categorías de gasto e ingreso: el catálogo base más las que cada persona
 * crea, renombra u oculta (ver `combinarCategorias`). `listar` incluye las
 * archivadas — los movimientos viejos las siguen nombrando —; los
 * formularios las filtran con `categoriasParaElegir`.
 */
export interface CategoriasApi {
  listar(): Observable<Categoria[]>;
  crear(datos: NuevaCategoria): Observable<Categoria>;
  actualizar(id: string, cambios: CambiosCategoria): Observable<void>;
}

export const CATEGORIAS_API = new InjectionToken<CategoriasApi>('CategoriasApi');

/**
 * Las categorías de un tipo que se ofrecen en un formulario: sin las
 * archivadas, salvo la que ya tiene elegida lo que se está editando — si
 * no, al editar un movimiento viejo su categoría desaparecería del select.
 */
export function categoriasParaElegir(
  categorias: readonly Categoria[],
  tipo: Categoria['tipo'],
  seleccionadaId?: string | null,
): Categoria[] {
  return categorias.filter((c) => c.tipo === tipo && (!c.archivada || c.id === seleccionadaId));
}

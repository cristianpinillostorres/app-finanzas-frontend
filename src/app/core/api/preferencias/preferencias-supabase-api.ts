import { Injectable, inject } from '@angular/core';
import { Observable, defer, map, of, tap } from 'rxjs';

import { AuthService } from '../../auth/auth.service';
import {
  type CambiosPreferencias,
  OBJETIVOS,
  type Objetivo,
  type Preferencias,
} from '../../models';
import { SincronizacionService } from '../../sync/sincronizador';
import type { PreferenciasApi } from './preferencias-api';
import { migrarPreferenciasLocales } from './migrar-preferencias-locales';

/** La única fila de `preferencias` de cada persona. */
const ID = 'app';

type Guardado = Record<string, unknown>;
type Grupo = Record<string, unknown> | undefined;

/**
 * Tabla `preferencias`: una fila por persona con todo en `datos` (jsonb).
 * Puede no existir todavía: entonces valen los valores iniciales
 * (`PREFERENCIAS_INICIALES`). `actualizar` combina los cambios con lo que
 * ya hay, así cada cambio toca solo sus campos.
 */
@Injectable()
export class PreferenciasSupabaseApi implements PreferenciasApi {
  private readonly sync = inject(SincronizacionService);
  private readonly auth = inject(AuthService);

  obtener(): Observable<Preferencias> {
    return defer(() => {
      let migrado = false;
      return this.sync
        .actual()
        .observar('preferencias')
        .pipe(
          map((filas) => mapearPreferencias(filas.find((f) => f.id === ID)?.['datos'])),
          tap((preferencias) => {
            // Una vez por sesión: lo que este navegador guardaba antes en
            // `localStorage` sube a la cuenta (ver `migrarPreferenciasLocales`).
            if (migrado) return;
            migrado = true;
            const cambios = migrarPreferenciasLocales(this.auth.uid(), preferencias);
            if (cambios) this.actualizar(cambios);
          }),
        );
    });
  }

  actualizar(cambios: CambiosPreferencias): Observable<void> {
    const sesion = this.sync.actual();
    sesion
      .obtener('preferencias', ID)
      .then((fila) => {
        const actuales = (fila?.['datos'] ?? {}) as Guardado;
        const datos: Guardado = { ...actuales };
        if (cambios.recorrido) {
          datos['recorrido'] = { ...(actuales['recorrido'] as Grupo), ...cambios.recorrido };
        }
        if (cambios.ultimaCuenta) {
          datos['ultimaCuenta'] = {
            ...(actuales['ultimaCuenta'] as Grupo),
            ...cambios.ultimaCuenta,
          };
        }
        // Una lista: lo elegido reemplaza lo anterior, no se suma.
        if (cambios.objetivos) datos['objetivos'] = cambios.objetivos;
        if (cambios.nombre !== undefined) datos['nombre'] = cambios.nombre;
        sesion.guardar('preferencias', { id: ID, datos });
      })
      .catch((error) => console.error('No se pudieron guardar las preferencias', error));
    return of(undefined);
  }
}

/** Completa con los valores iniciales lo que la fila no tenga. */
function mapearPreferencias(datos: unknown): Preferencias {
  const guardado = (datos ?? {}) as Guardado;
  const recorrido = (guardado['recorrido'] ?? {}) as Record<string, unknown>;
  const ultimaCuenta = (guardado['ultimaCuenta'] ?? {}) as Record<string, unknown>;
  const omitidos = recorrido['omitidos'];
  const objetivos = guardado['objetivos'];
  const nombre = guardado['nombre'];
  return {
    recorrido: {
      oculto: recorrido['oculto'] === true,
      omitidos: Array.isArray(omitidos)
        ? omitidos.filter((id: unknown): id is string => typeof id === 'string')
        : [],
    },
    ultimaCuenta: {
      gasto: typeof ultimaCuenta['gasto'] === 'string' ? ultimaCuenta['gasto'] : null,
      ingreso: typeof ultimaCuenta['ingreso'] === 'string' ? ultimaCuenta['ingreso'] : null,
    },
    objetivos: Array.isArray(objetivos)
      ? objetivos.filter((o: unknown): o is Objetivo => OBJETIVOS.includes(o as Objetivo))
      : [],
    nombre: typeof nombre === 'string' && nombre.trim() ? nombre.trim() : null,
  };
}

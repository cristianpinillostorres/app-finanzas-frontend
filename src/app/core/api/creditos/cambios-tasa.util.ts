import { computed, inject, type Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map, of, switchMap } from 'rxjs';

import type { CambioTasa, Credito } from '../../models';
import { CREDITOS_API } from './creditos-api';

/**
 * Historial de cambios de tasa de todos los créditos de banco, en una sola
 * lista plana.
 *
 * Se pide por crédito (`CreditosApi.listarCambiosTasa(id)`, como un
 * endpoint anidado) y se combina, re-consultando si cambia el conjunto de
 * bancos. Cada lista ya llega en vivo desde la copia local; `refresco`, un
 * signal cuyo cambio fuerza a volver a pedir, se conserva por compatibilidad
 * con quienes lo pasan.
 *
 * Vive acá y no dentro de una pantalla porque lo necesitan tres: Créditos,
 * General y Pagos fijos. Esa duplicación fue justamente el origen de un
 * bug real — solo Créditos pedía estos datos, y como `tasaEaVigente` cae en
 * silencio a la tasa base del crédito cuando no los recibe, las otras dos
 * pantallas calculaban deuda y cuota con una tasa vieja sin que nada
 * fallara. Quien calcule algo de un crédito de banco necesita esto.
 *
 * Debe llamarse en contexto de inyección (inicializador de campo o
 * constructor).
 */
export function cambiosTasaDeBancos(
  creditos: Signal<Credito[]>,
  refresco?: Signal<unknown>,
): Signal<CambioTasa[]> {
  const creditosApi = inject(CREDITOS_API);
  const bancos = computed(() => creditos().filter((c) => c.grupo === 'BANCO'));

  return toSignal(
    toObservable(computed(() => ({ bancos: bancos(), refresco: refresco?.() }))).pipe(
      switchMap(({ bancos }) =>
        bancos.length === 0
          ? of([] as CambioTasa[])
          : combineLatest(bancos.map((b) => creditosApi.listarCambiosTasa(b.id))).pipe(
              map((porBanco) => porBanco.flat()),
            ),
      ),
    ),
    { initialValue: [] as CambioTasa[] },
  );
}

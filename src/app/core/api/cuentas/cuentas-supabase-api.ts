import { Injectable, inject } from '@angular/core';
import { Observable, defer, from, map, of } from 'rxjs';

import type { Cuenta, NuevaCuenta, NuevoBolsillo } from '../../models';
import { SincronizacionService } from '../../sync/sincronizador';
import { type Fila, idNuevo } from '../../sync/tablas';
import type { CuentasApi } from './cuentas-api';

/**
 * Tabla `cuentas` — cuentas y bolsillos juntos (un bolsillo tiene
 * `cuentaPadreId`). Lee y escribe la copia local de `SesionLocal`: las
 * listas son en vivo y las escrituras resuelven sin esperar al servidor,
 * así que funcionan sin señal.
 *
 * `aCuenta` devuelve `cuentaPadreId: null` y no `undefined` cuando falta:
 * es un valor de dominio real ("es una cuenta raíz", ver
 * `cuentas-agrupadas.ts`).
 */
@Injectable()
export class CuentasSupabaseApi implements CuentasApi {
  private readonly sync = inject(SincronizacionService);

  listar(): Observable<Cuenta[]> {
    return defer(() => this.sync.actual().observar('cuentas')).pipe(
      map((filas) => filas.map(aCuenta)),
    );
  }

  obtener(id: string): Observable<Cuenta | undefined> {
    return defer(() => from(this.sync.actual().obtener('cuentas', id))).pipe(
      map((fila) => (fila ? aCuenta(fila) : undefined)),
    );
  }

  crear(datos: NuevaCuenta): Observable<Cuenta> {
    const cuenta: Cuenta = {
      ...datos,
      id: idNuevo(),
      cuentaPadreId: null,
      reservado: false,
      archivada: false,
      creadoEn: new Date().toISOString(),
    };
    this.sync.actual().guardar('cuentas', cuenta as unknown as Fila);
    return of(cuenta);
  }

  crearBolsillo(datos: NuevoBolsillo): Observable<Cuenta> {
    const sesion = this.sync.actual();
    return from(
      (async () => {
        // `NuevoBolsillo.cuentaPadreId` conserva el tipo `string | null` de
        // `Cuenta`, pero un bolsillo sin madre no tiene sentido — lo valida
        // el formulario, esto es una red de seguridad.
        if (!datos.cuentaPadreId) {
          throw new Error('Un bolsillo necesita una cuenta madre.');
        }
        const padreFila = await sesion.obtener('cuentas', datos.cuentaPadreId);
        if (!padreFila) {
          throw new Error(`La cuenta madre ${datos.cuentaPadreId} no existe`);
        }
        const padre = aCuenta(padreFila);

        // Un bolsillo hereda tipo/entidad/sumaEnDisponible de su cuenta
        // madre (no aplican como concepto propio — `NuevoBolsillo` ni
        // siquiera los pide, ver `CuentasApi`).
        const bolsillo: Cuenta = {
          ...datos,
          id: idNuevo(),
          tipo: padre.tipo,
          entidad: padre.entidad,
          sumaEnDisponible: padre.sumaEnDisponible,
          archivada: false,
          creadoEn: new Date().toISOString(),
        };
        sesion.guardar('cuentas', bolsillo as unknown as Fila);
        return bolsillo;
      })(),
    );
  }

  actualizar(id: string, cambios: Partial<Cuenta>): Observable<Cuenta> {
    return from(this.sync.actual().actualizar('cuentas', id, cambios)).pipe(map(aCuenta));
  }

  archivar(id: string): Observable<void> {
    this.sync
      .actual()
      .actualizar('cuentas', id, { archivada: true })
      .catch((error) => console.error(`No se pudo archivar la cuenta ${id}`, error));
    return of(undefined);
  }
}

function aCuenta(fila: Fila): Cuenta {
  return {
    ...(fila as unknown as Cuenta),
    cuentaPadreId: (fila['cuentaPadreId'] as string | undefined) ?? null,
  };
}
